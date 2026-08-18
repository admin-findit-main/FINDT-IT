"use server";

import { isDemoMode } from "@/lib/config/env";
import { getDemoState } from "@/lib/demo/store";
import { getCurrentProfile, getStoreWorkspaceAction } from "@/lib/services/actions";

export async function getStoreTeamAction(storeId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const workspace = await getStoreWorkspaceAction();
  if (
    profile.account_type !== "admin" &&
    (!workspace?.canManageStore || workspace.store?.id !== storeId)
  ) {
    return [];
  }

  if (isDemoMode()) {
    const state = getDemoState();
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

export async function getStoreInvitesAction(storeId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const workspace = await getStoreWorkspaceAction();
  if (
    profile.account_type !== "admin" &&
    (!workspace?.canManageStore || workspace.store?.id !== storeId)
  ) {
    return [];
  }

  if (isDemoMode()) {
    return getDemoState()
      .invites.filter((i) => i.store_id === storeId && !i.accepted_at)
      .map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        name: i.invitee_name || null,
        expires_at: i.expires_at,
      }));
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_invites")
    .select("id, email, role, invitee_name, expires_at, accepted_at")
    .eq("store_id", storeId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  return (data || []).map((i: {
    id: string;
    email: string;
    role: string;
    invitee_name?: string | null;
    expires_at: string;
  }) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    name: i.invitee_name || null,
    expires_at: i.expires_at,
  }));
}
