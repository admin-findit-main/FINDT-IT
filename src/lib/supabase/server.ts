import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabasePublishableKey, isSupabaseConfigured } from "@/lib/config/env";
import { supabaseCookieOptions } from "@/lib/config/product-hosts";

export async function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const cookieStore = await cookies();
  const key = getSupabasePublishableKey()!;
  const host = (await headers()).get("host") || "";
  const cookieOptions = supabaseCookieOptions(host);

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...options, ...cookieOptions })
            );
          } catch {
            // Called from a Server Component — proxy will refresh sessions.
          }
        },
      },
    }
  );
}
