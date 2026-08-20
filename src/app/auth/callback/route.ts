import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { coerceSoloAdminProfile } from "@/lib/auth/admin";
import { isSafeNextPath, resolvePostAuthDestination } from "@/lib/auth/home-path";
import {
  getSupabasePublishableKey,
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/config/env";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (isDemoMode() || !isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      getSupabasePublishableKey()!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component context
            }
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase
            .from("profiles")
            .select("account_type, email")
            .eq("id", user.id)
            .maybeSingle()
        : { data: null };
      const { count } = user
        ? await supabase
            .from("store_members")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "active")
        : { count: 0 };
      const dest = resolvePostAuthDestination({
        profile: coerceSoloAdminProfile(
          {
            email: profile?.email,
            account_type: profile?.account_type,
          },
          user?.email
        ),
        authEmail: user?.email,
        hasActiveStoreMembership: (count || 0) > 0,
        next: isSafeNextPath(next) ? next : null,
      });
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
