"use server";

import { isSoloAdmin } from "@/lib/auth/admin";
import { logSecurityEvent } from "@/lib/security/audit";
import { getCurrentProfile } from "@/lib/services/actions";
import { isDemoMode } from "@/lib/config/env";

export type AdminPersonRow = {
  id: string;
  name: string;
  email: string | null;
  accountType: string;
  plan: string;
  suspended: boolean;
  createdAt: string;
  storeName: string | null;
};

export async function getAdminPeopleAction(kind: "shopper" | "owner") {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return [];
  if (isDemoMode()) return [];
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  if (kind === "shopper") {
    const { data } = await admin
      .from("profiles")
      .select("id, first_name, last_name, display_name, email, account_type, subscription_plan, is_suspended, created_at")
      .eq("account_type", "customer")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data || []).map((row) => ({
      id: row.id as string,
      name:
        [row.first_name, row.last_name].filter(Boolean).join(" ") ||
        row.display_name ||
        "—",
      email: row.email as string | null,
      accountType: row.account_type as string,
      plan: (row.subscription_plan as string) || "free",
      suspended: Boolean(row.is_suspended),
      createdAt: row.created_at as string,
      storeName: null,
    })) satisfies AdminPersonRow[];
  }

  const { data: stores } = await admin
    .from("stores")
    .select("id, name, owner_id")
    .order("name");
  const ownerIds = [...new Set((stores || []).map((s) => s.owner_id).filter(Boolean))];
  const { data: owners } = ownerIds.length
    ? await admin
        .from("profiles")
        .select("id, first_name, last_name, display_name, email, account_type, subscription_plan, is_suspended, created_at")
        .in("id", ownerIds)
    : { data: [] };
  const storeByOwner = new Map<string, string>();
  for (const store of stores || []) {
    if (store.owner_id && !storeByOwner.has(store.owner_id)) {
      storeByOwner.set(store.owner_id, store.name);
    }
  }
  return (owners || []).map((row) => ({
    id: row.id as string,
    name:
      [row.first_name, row.last_name].filter(Boolean).join(" ") ||
      row.display_name ||
      "—",
    email: row.email as string | null,
    accountType: row.account_type as string,
    plan: (row.subscription_plan as string) || "free",
    suspended: Boolean(row.is_suspended),
    createdAt: row.created_at as string,
    storeName: storeByOwner.get(row.id as string) || null,
  })) satisfies AdminPersonRow[];
}

export async function setProfileSuspendedAction(userId: string, suspended: boolean) {
  const profile = await getCurrentProfile();
  if (!profile || !isSoloAdmin(profile)) return { error: "Admin only" };
  if (userId === profile.id) return { error: "You cannot suspend yourself." };
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, email, account_type")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return { error: "Account not found" };
  if (isSoloAdmin(target)) return { error: "The operator account cannot be suspended." };
  const { error } = await admin
    .from("profiles")
    .update({ is_suspended: suspended })
    .eq("id", userId);
  if (error) return { error: "Couldn't update that account." };
  void logSecurityEvent({
    actorId: profile.id,
    action: suspended ? "profile_suspended" : "profile_restored",
    resource: userId,
  });
  return { ok: true as const };
}

export async function getAdminRequestsAction() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return [];
  if (isDemoMode()) return [];
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("customer_requests")
    .select("id, product_name, city, state, status, stores_targeted, created_at")
    .order("created_at", { ascending: false })
    .limit(80);
  return data || [];
}

export async function getAdminAuditAction() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return [];
  if (isDemoMode()) return [];
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("security_audit_events")
    .select("id, actor_id, action, resource, ip, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return data || [];
}
