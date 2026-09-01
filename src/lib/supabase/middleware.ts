import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { coerceSoloAdminProfile, isSoloAdmin } from "@/lib/auth/admin";
import {
  isAdminAppPath,
  isCustomerSurfacePath,
  isStoreAppPath,
  resolvePostAuthDestination,
} from "@/lib/auth/home-path";
import { isOwnerOnlyStorePath } from "@/lib/auth/store-role";
import { customerNeedsFirstName } from "@findit/domain";
import {
  getSupabasePublishableKey,
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/config/env";
import {
  classifyStoreActor,
  decideHostRouting,
  type StoreActor,
} from "@/lib/config/host-gateway";
import {
  matchProductSurface,
  supabaseCookieOptions,
  toInternalPath,
} from "@/lib/config/product-hosts";

async function resolveHomeForUser(
  supabase: ReturnType<typeof createServerClient>,
  user: { id: string; email?: string | null },
  next?: string | null
): Promise<string> {
  const [{ data: profile }, { count }] = await Promise.all([
    supabase
      .from("profiles")
      .select("account_type, email, first_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("store_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  const resolved = coerceSoloAdminProfile(
    {
      email: profile?.email,
      account_type: profile?.account_type,
    },
    user.email
  );

  return resolvePostAuthDestination({
    profile: resolved,
    authEmail: user.email,
    hasActiveStoreMembership: (count || 0) > 0,
    next,
  });
}

function isServerActionRequest(request: NextRequest) {
  return request.method === "POST" && request.headers.has("next-action");
}

function applyCookieDomain(
  options: Partial<ResponseCookie> | undefined,
  hostHeader: string
): Partial<ResponseCookie> {
  return { ...options, ...supabaseCookieOptions(hostHeader) };
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

export async function updateSession(request: NextRequest) {
  const hostHeader = request.headers.get("host") || "";
  const path = request.nextUrl.pathname;
  if (path === "/sw.js" || path === "/offline.html") {
    return NextResponse.next();
  }
  const surface = matchProductSurface(hostHeader);

  const authCode = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const isAuthHandoffPath =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/start") ||
    path.startsWith("/auth/update-password");
  if (
    !path.startsWith("/auth/callback") &&
    (tokenHash || (authCode && isAuthHandoffPath))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    if (
      path.startsWith("/auth/update-password") &&
      !url.searchParams.get("next")
    ) {
      url.searchParams.set("next", "/auth/update-password");
    }
    return NextResponse.redirect(url);
  }

  if (isServerActionRequest(request)) {
    if (surface !== "local" && surface !== "apex" && surface !== "www" && surface !== "app") {
      const internalPath = toInternalPath(surface, path);
      if (internalPath !== path) {
        const url = request.nextUrl.clone();
        url.pathname = internalPath;
        return NextResponse.rewrite(url, { request });
      }
    }
    return NextResponse.next({ request });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-findit-surface", surface === "apex" ? "www" : surface);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (!isSupabaseConfigured() || isDemoMode()) {
    const demoDecision = decideHostRouting(request, "anonymous");
    const gated = applyHostDecision(request, supabaseResponse, demoDecision, requestHeaders);
    if (gated) return gated;
    return finish(request, supabaseResponse, demoDecision, requestHeaders);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabasePublishableKey()!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              applyCookieDomain(options, hostHeader)
            )
          );
        },
      },
    }
  );

  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (err) {
    console.error("[FINDIT] session refresh failed", {
      path,
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown",
    });
  }

  let actor: StoreActor = "anonymous";
  let resolvedProfile: {
    email?: string | null;
    account_type?: string | null;
    first_name?: string | null;
  } | null = null;
  let memberRole: string | null = null;
  let profileSuspended = false;

  if (user) {
    const [{ data: profile }, { data: membership }] = await Promise.all([
      supabase
        .from("profiles")
        .select("account_type, email, first_name, is_suspended")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("store_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);
    resolvedProfile = coerceSoloAdminProfile(
      {
        email: profile?.email,
        account_type: profile?.account_type,
        first_name: profile?.first_name,
      },
      user.email
    );
    profileSuspended = Boolean(profile?.is_suspended);
    memberRole = membership?.role ?? null;
    actor = classifyStoreActor({
      isAdmin: isSoloAdmin(resolvedProfile),
      accountType: resolvedProfile?.account_type,
      memberRole,
      hasStoreMembership: Boolean(memberRole),
    });
  }

  const decision = decideHostRouting(request, actor);
  const gated = applyHostDecision(request, supabaseResponse, decision, requestHeaders);
  if (gated) return gated;

  const internalPath =
    decision.kind === "continue" ? decision.internalPath : path;
  const isSuspendedPage = internalPath.startsWith("/account-suspended");
  if (user && profileSuspended) {
    const admin = isSoloAdmin(resolvedProfile);
    if (!admin && !isSuspendedPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/account-suspended";
      url.search = "";
      return copyCookies(supabaseResponse, NextResponse.redirect(url));
    }
  }

  const isAuthRoute =
    internalPath.startsWith("/login") ||
    internalPath.startsWith("/signup") ||
    internalPath.startsWith("/forgot-password");
  const isWelcome = internalPath.startsWith("/welcome");
  const isPasswordUpdate = internalPath.startsWith("/auth/update-password");
  const isLanding = internalPath === "/" && surface !== "dashboard" && surface !== "store";
  const isHubConnect =
    internalPath === "/store/hub/connect" ||
    internalPath.startsWith("/store/hub/connect/");
  const isHubTerminal =
    internalPath === "/store/hub" || internalPath.startsWith("/store/hub/");
  const hasHubDevice = Boolean(request.cookies.get("findit_hub_device")?.value);
  const isProtected =
    internalPath.startsWith("/home") ||
    internalPath.startsWith("/requests") ||
    internalPath.startsWith("/shops") ||
    internalPath.startsWith("/notifications") ||
    internalPath.startsWith("/profile") ||
    internalPath.startsWith("/plan") ||
    isStoreAppPath(internalPath) ||
    isAdminAppPath(internalPath) ||
    isWelcome;

  if (!user && isHubConnect) {
    return finish(request, supabaseResponse, decision, requestHeaders);
  }
  if (!user && isHubTerminal && hasHubDevice) {
    return finish(request, supabaseResponse, decision, requestHeaders);
  }
  if (!user && isHubTerminal && !isHubConnect) {
    const url = request.nextUrl.clone();
    url.pathname = surface === "store" ? "/hub/connect" : "/store/hub/connect";
    url.search = "";
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    const shopperApp =
      internalPath.startsWith("/home") ||
      internalPath.startsWith("/requests") ||
      internalPath.startsWith("/shops") ||
      internalPath.startsWith("/notifications") ||
      internalPath.startsWith("/profile") ||
      internalPath.startsWith("/plan") ||
      isWelcome;
    url.pathname =
      isStoreAppPath(internalPath) || isAdminAppPath(internalPath)
        ? surface === "store"
          ? "/login"
          : "/login/business"
        : shopperApp
          ? "/start"
          : "/login";
    if (!shopperApp) {
      url.searchParams.set("next", internalPath);
    } else {
      url.search = "";
    }
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  if (user && resolvedProfile) {
    const isOperator = isSoloAdmin(resolvedProfile);
    const onCustomerSurface = isCustomerSurfacePath(internalPath);

    if (isOperator && (onCustomerSurface || isStoreAppPath(internalPath))) {
      if (!internalPath.startsWith("/store/hub")) {
        const url = request.nextUrl.clone();
        if (surface === "store") {
          url.pathname = "/admin";
          url.search = "";
          return copyCookies(supabaseResponse, NextResponse.redirect(url));
        }
        const dest = new URL("https://store.askfindit.com/admin");
        if (surface === "local") {
          url.pathname = "/admin";
          url.search = "";
          return copyCookies(supabaseResponse, NextResponse.redirect(url));
        }
        dest.search = "";
        return copyCookies(supabaseResponse, NextResponse.redirect(dest));
      }
    }

    const needsName = customerNeedsFirstName(resolvedProfile);

    if (needsName && !isWelcome && !isPasswordUpdate && surface !== "www" && surface !== "app") {
      const url = request.nextUrl.clone();
      url.pathname = "/welcome";
      url.search = "";
      return copyCookies(supabaseResponse, NextResponse.redirect(url));
    }

    if (!needsName && isWelcome) {
      const url = request.nextUrl.clone();
      url.pathname = isOperator ? "/admin" : "/home";
      url.search = "";
      return copyCookies(supabaseResponse, NextResponse.redirect(url));
    }
  }

  if (user && isAuthRoute && !isPasswordUpdate && surface !== "www") {
    const next = request.nextUrl.searchParams.get("next");
    const home = await resolveHomeForUser(supabase, user, next);
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  // www stays a marketing site even when a session cookie is present.
  if (user && isLanding && surface === "local") {
    const home = await resolveHomeForUser(supabase, user);
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  if (user && isOwnerOnlyStorePath(internalPath)) {
    if (!isSoloAdmin(resolvedProfile) && memberRole === "employee") {
      const url = request.nextUrl.clone();
      url.pathname = surface === "store" ? "/hub" : "/store/hub";
      url.search = "";
      return copyCookies(supabaseResponse, NextResponse.redirect(url));
    }
  }

  return finish(request, supabaseResponse, decision, requestHeaders);
}

function applyHostDecision(
  request: NextRequest,
  supabaseResponse: NextResponse,
  decision: ReturnType<typeof decideHostRouting>,
  requestHeaders: Headers
): NextResponse | null {
  if (decision.kind === "redirect") {
    const response = NextResponse.redirect(decision.url, decision.permanent ? 308 : 307);
    return copyCookies(supabaseResponse, response);
  }
  if (decision.kind === "continue" && !decision.rewrite) {
    supabaseResponse.headers.set("x-findit-surface", requestHeaders.get("x-findit-surface") || "");
    return null;
  }
  return null;
}

function finish(
  request: NextRequest,
  supabaseResponse: NextResponse,
  decision: ReturnType<typeof decideHostRouting>,
  requestHeaders: Headers
): NextResponse {
  if (decision.kind !== "continue" || !decision.rewrite) {
    return supabaseResponse;
  }
  const url = request.nextUrl.clone();
  url.pathname = decision.internalPath;
  const rewritten = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
  return copyCookies(supabaseResponse, rewritten);
}
