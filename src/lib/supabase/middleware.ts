import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSoloAdminEmail } from "@/lib/auth/admin";
import { isSafeNextPath, resolveAppHome } from "@/lib/auth/home-path";
import { isOwnerOnlyStorePath } from "@/lib/auth/store-role";
import { customerNeedsFirstName } from "@findit/domain";
import {
  dedicatedHosts,
  getSupabasePublishableKey,
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/config/env";
import {
  matchHostSurface,
  resolveHostPathRedirect,
} from "@/lib/config/hosts";

async function resolveHomeForUser(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, email, first_name")
    .eq("id", userId)
    .maybeSingle();

  const accountType =
    profile?.account_type === "admin" && !isSoloAdminEmail(profile.email)
      ? "customer"
      : (profile?.account_type as string | undefined);
  if (accountType === "admin" && isSoloAdminEmail(profile?.email)) return "/admin";
  if (accountType === "business") return "/store";

  const { count } = await supabase
    .from("store_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");

  return resolveAppHome({
    accountType,
    hasActiveStoreMembership: (count || 0) > 0,
  });
}

function isServerActionRequest(request: NextRequest) {
  return request.method === "POST" && request.headers.has("next-action");
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const hostRedirect = resolveHostPathRedirect(
    matchHostSurface(request.headers.get("host") || "", dedicatedHosts()),
    path
  );
  if (hostRedirect && !isServerActionRequest(request)) {
    const url = request.nextUrl.clone();
    url.pathname = hostRedirect;
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  if (!isSupabaseConfigured() || isDemoMode()) {
    return supabaseResponse;
  }

  // Skip Auth refresh on Server Actions. Calling getUser() here has left
  // signup/login stuck on "Creating…" because the POST never finished.
  if (isServerActionRequest(request)) {
    return supabaseResponse;
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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
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
    console.error("[FINDIT] session refresh failed", err);
  }

  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password");
  const isWelcome = path.startsWith("/welcome");
  const isPasswordUpdate = path.startsWith("/auth/update-password");
  const isLanding = path === "/";
  const isHubConnect = path === "/store/hub/connect" || path.startsWith("/store/hub/connect/");
  const isHubTerminal = path === "/store/hub" || path.startsWith("/store/hub/");
  const hasHubDevice = Boolean(request.cookies.get("findit_hub_device")?.value);
  const isProtected =
    path.startsWith("/home") ||
    path.startsWith("/requests") ||
    path.startsWith("/notifications") ||
    path.startsWith("/profile") ||
    path.startsWith("/plan") ||
    path.startsWith("/store") ||
    path.startsWith("/admin") ||
    isWelcome;

  if (!user && isHubConnect) {
    return supabaseResponse;
  }
  if (!user && isHubTerminal && hasHubDevice) {
    return supabaseResponse;
  }
  if (!user && isHubTerminal && !isHubConnect) {
    const url = request.nextUrl.clone();
    url.pathname = "/store/hub/connect";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname =
      path.startsWith("/store") || path.startsWith("/admin")
        ? "/login/business"
        : "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type, email, first_name")
      .eq("id", user.id)
      .maybeSingle();
    const needsName = customerNeedsFirstName(profile || {});

    if (needsName && !isWelcome && !isPasswordUpdate) {
      const url = request.nextUrl.clone();
      url.pathname = "/welcome";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (!needsName && isWelcome) {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (user && isAuthRoute && !isPasswordUpdate) {
    const next = request.nextUrl.searchParams.get("next");
    const url = request.nextUrl.clone();
    if (isSafeNextPath(next)) {
      url.pathname = next;
      url.search = "";
      return NextResponse.redirect(url);
    }
    const home = await resolveHomeForUser(supabase, user.id);
    url.pathname = home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isLanding) {
    const home = await resolveHomeForUser(supabase, user.id);
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isOwnerOnlyStorePath(path)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type, email")
      .eq("id", user.id)
      .maybeSingle();
    if (!isSoloAdminEmail(profile?.email) || profile?.account_type !== "admin") {
      const { data: membership } = await supabase
        .from("store_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (membership?.role === "employee") {
        const url = request.nextUrl.clone();
        url.pathname = "/store/hub";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  if (!user && isPasswordUpdate) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
