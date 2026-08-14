import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSafeNextPath, resolveAppHome } from "@/lib/auth/home-path";
import { isOwnerOnlyStorePath } from "@/lib/auth/store-role";
import {
  getSupabasePublishableKey,
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/config/env";

async function resolveHomeForUser(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", userId)
    .maybeSingle();

  const accountType = profile?.account_type as string | undefined;
  if (accountType === "admin") return "/admin";
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

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured() || isDemoMode()) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password");
  const isPasswordUpdate = path.startsWith("/auth/update-password");
  const isLanding = path === "/";
  const isProtected =
    path.startsWith("/home") ||
    path.startsWith("/requests") ||
    path.startsWith("/notifications") ||
    path.startsWith("/profile") ||
    path.startsWith("/store") ||
    path.startsWith("/admin");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
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
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.account_type !== "admin") {
      const { data: membership } = await supabase
        .from("store_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (membership?.role === "employee") {
        const url = request.nextUrl.clone();
        url.pathname = "/store";
        url.searchParams.set("notice", "manager");
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
