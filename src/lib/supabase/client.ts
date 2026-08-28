import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabasePublishableKey, isSupabaseConfigured } from "@/lib/config/env";
import { supabaseCookieOptions } from "@/lib/config/product-hosts";
import { looksLikeServiceRoleKey } from "@findit/domain";

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)."
    );
  }
  const key = getSupabasePublishableKey()!;
  if (looksLikeServiceRoleKey(key)) {
    throw new Error("Browser client must use the public anon key only.");
  }
  const host = typeof window !== "undefined" ? window.location.host : "";
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      cookieOptions: supabaseCookieOptions(host),
    }
  );
}
