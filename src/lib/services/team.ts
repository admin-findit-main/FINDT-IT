"use server";

import { isDemoMode } from "@/lib/config/env";
import { getDemoState } from "@/lib/demo/store";
import { getCurrentProfile } from "@/lib/services/actions";

export async function getStoreTeamAction(storeId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  if (isDemoMode()) {
    const state = getDemoState();
    const member = state.storeMembers.find(
      (m) => m.store_id === storeId && m.user_id === profile.id && m.status === "active"
    );
    if (!member && profile.account_type !== "admin") return [];
    return state.storeMembers
      .filter((m) => m.store_id === storeId)
      .map((m) => {
        const user = state.profiles.find((p) => p.id === m.user_id);
        return {
          ...m,
          email: user?.email || null,
          name: user?.first_name || user?.display_name || null,
        };
      });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_members")
    .select("*, profile:profiles(email, first_name, display_name)")
    .eq("store_id", storeId);
  return (data || []).map((m: {
    id: string;
    store_id: string;
    user_id: string | null;
    role: string;
    status: string;
    created_at: string;
    profile?: { email?: string; first_name?: string; display_name?: string } | null;
  }) => ({
    id: m.id,
    store_id: m.store_id,
    user_id: m.user_id,
    role: m.role,
    status: m.status,
    created_at: m.created_at,
    email: m.profile?.email || null,
    name: m.profile?.first_name || m.profile?.display_name || null,
  }));
}
