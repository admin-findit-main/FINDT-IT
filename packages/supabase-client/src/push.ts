import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushPlatform } from "@findit/types";

/**
 * Upsert Expo / FCM / APNs token into device_push_tokens (RLS: own rows only).
 */
export async function registerPushToken(
  supabase: SupabaseClient,
  input: {
    token: string;
    platform: PushPlatform;
    appSurface: "customer" | "employee" | "web";
    storeId?: string | null;
  }
): Promise<{ ok: true } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("device_push_tokens").upsert(
    {
      user_id: user.id,
      token: input.token,
      platform: input.platform,
      app_surface: input.appSurface,
      store_id: input.storeId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" }
  );

  if (error) return { error: error.message };
  return { ok: true };
}

export async function unregisterPushToken(
  supabase: SupabaseClient,
  token: string
): Promise<void> {
  await supabase.from("device_push_tokens").delete().eq("token", token);
}
