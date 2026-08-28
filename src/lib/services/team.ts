"use server";

import { boundUuid } from "@findit/domain";
import { isDemoMode } from "@/lib/config/env";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getDemoState } from "@/lib/demo/store";
import { getCurrentProfile, getStoreWorkspaceAction } from "@/lib/services/actions";

async function canManageTeam(storeId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return false;
  if (isSoloAdmin(profile)) return true;
  const workspace = await getStoreWorkspaceAction();
  return Boolean(workspace?.canManageStore && workspace.store?.id === storeId);
}

export async function getStoreTeamAction(storeId: string) {
  const id = boundUuid(storeId);
  if (!id) return [];
  if (!(await canManageTeam(id))) return [];

  if (isDemoMode()) {
    const state = getDemoState();
    return state.storeMembers
      .filter((m) => m.store_id === id)
      .map((m) => {
        const user = state.profiles.find((p) => p.id === m.user_id);
        return {
          ...m,
          email: user?.email || null,
          name: user?.first_name || user?.display_name || null,
        };
      });
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: members } = await admin
    .from("store_members")
    .select("id, store_id, user_id, role, status, created_at")
    .eq("store_id", id)
    .order("created_at", { ascending: true });
  const rows = members || [];
  const userIds = [
    ...new Set(rows.map((m) => m.user_id).filter((id): id is string => Boolean(id))),
  ];
  const { data: profiles } = userIds.length
    ? await admin
        .from("profiles")
        .select("id, email, first_name, display_name")
        .in("id", userIds)
    : { data: [] as { id: string; email: string | null; first_name: string | null; display_name: string | null }[] };
  const byId = new Map((profiles || []).map((p) => [p.id, p]));
  return rows.map((m) => {
    const user = m.user_id ? byId.get(m.user_id) : null;
    return {
      ...m,
      email: user?.email || null,
      name: user?.first_name || user?.display_name || null,
    };
  });
}

export async function getStoreInvitesAction(storeId: string) {
  const id = boundUuid(storeId);
  if (!id) return [];
  if (!(await canManageTeam(id))) return [];

  if (isDemoMode()) {
    return getDemoState()
      .invites.filter((i) => i.store_id === id && !i.accepted_at)
      .map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        name: i.invitee_name || null,
        expires_at: i.expires_at,
      }));
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("store_invites")
    .select("id, email, role, invitee_name, expires_at, accepted_at")
    .eq("store_id", id)
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
