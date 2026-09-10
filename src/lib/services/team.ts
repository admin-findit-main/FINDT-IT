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

export type StoreTeamMemberView = {
  id: string;
  store_id: string;
  user_id: string | null;
  role: string;
  status: string;
  created_at: string;
  email: string | null;
  name: string | null;
};

export type StoreInviteView = {
  id: string;
  email: string;
  role: string;
  name: string | null;
  expires_at: string;
  token: string;
};

export async function getStoreTeamAction(storeId: string): Promise<StoreTeamMemberView[]> {
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
    ...new Set(rows.map((m) => m.user_id).filter((uid): uid is string => Boolean(uid))),
  ];
  const { data: profiles } = userIds.length
    ? await admin
        .from("profiles")
        .select("id, email, first_name, display_name")
        .in("id", userIds)
    : {
        data: [] as {
          id: string;
          email: string | null;
          first_name: string | null;
          display_name: string | null;
        }[],
      };
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

export async function getStoreInvitesAction(storeId: string): Promise<StoreInviteView[]> {
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
        token: i.token,
      }));
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("store_invites")
    .select("id, email, role, invitee_name, expires_at, accepted_at, token")
    .eq("store_id", id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  return (data || []).map(
    (i: {
      id: string;
      email: string;
      role: string;
      invitee_name?: string | null;
      expires_at: string;
      token: string;
    }) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      name: i.invitee_name || null,
      expires_at: i.expires_at,
      token: i.token,
    })
  );
}

export async function cancelStoreInviteAction(storeId: string, inviteId: string) {
  const id = boundUuid(storeId);
  const inviteUuid = boundUuid(inviteId);
  if (!id || !inviteUuid) return { error: "Invalid invite" };
  if (!(await canManageTeam(id))) return { error: "Not allowed" };

  if (isDemoMode()) {
    const state = getDemoState();
    const idx = state.invites.findIndex(
      (i) => i.id === inviteUuid && i.store_id === id && !i.accepted_at
    );
    if (idx < 0) return { error: "Invite not found" };
    state.invites.splice(idx, 1);
    return { ok: true as const };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { error } = await admin
    .from("store_invites")
    .delete()
    .eq("id", inviteUuid)
    .eq("store_id", id)
    .is("accepted_at", null);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function setStoreMemberStatusAction(
  storeId: string,
  memberId: string,
  status: "active" | "disabled"
) {
  const id = boundUuid(storeId);
  const memberUuid = boundUuid(memberId);
  if (!id || !memberUuid) return { error: "Invalid member" };
  if (!(await canManageTeam(id))) return { error: "Not allowed" };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized" };

  if (isDemoMode()) {
    const state = getDemoState();
    const member = state.storeMembers.find(
      (m) => m.id === memberUuid && m.store_id === id
    );
    if (!member) return { error: "Member not found" };
    if (member.role === "owner") return { error: "Owners can’t be disabled here" };
    if (member.user_id === profile.id) return { error: "You can’t disable yourself" };
    member.status = status;
    return { ok: true as const };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: member } = await admin
    .from("store_members")
    .select("id, role, user_id")
    .eq("id", memberUuid)
    .eq("store_id", id)
    .maybeSingle();
  if (!member) return { error: "Member not found" };
  if (member.role === "owner") return { error: "Owners can’t be disabled here" };
  if (member.user_id === profile.id) return { error: "You can’t disable yourself" };

  const { error } = await admin
    .from("store_members")
    .update({ status })
    .eq("id", memberUuid)
    .eq("store_id", id);
  if (error) return { error: error.message };
  return { ok: true as const };
}
