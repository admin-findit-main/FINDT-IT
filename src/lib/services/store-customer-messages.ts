"use server";

import { boundUuid } from "@findit/domain";
import { isDemoMode } from "@/lib/config/env";
import { logSecurityEvent } from "@/lib/security/audit";
import { notifyCustomerDevices } from "@/lib/services/expo-push";
import {
  getCurrentProfile,
  getStoreWorkspaceAction,
} from "@/lib/services/actions";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const TITLE_MAX = 80;
const BODY_MAX = 240;

/**
 * Pilot audience: linked store customers who are not suspended and have at least
 * one customer/web push token. Dual marketing opt-in defaults were mass-reset to
 * false, which made the old audience always empty.
 *
 * Hard opt-out: profiles.notify_store_promotions === false is still respected.
 */
async function reachableCustomerIds(storeId: string) {
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();

  const { data: rows, error } = await admin
    .from("store_customers")
    .select("customer_id")
    .eq("store_id", storeId)
    .is("removed_at", null)
    .not("customer_id", "is", null);

  if (error) {
    return { admin, userIds: [] as string[], error: error.message };
  }

  const linkedIds = [
    ...new Set(
      (rows || [])
        .map((row) => boundUuid(String(row.customer_id || "")))
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (!linkedIds.length) return { admin, userIds: [] as string[] };

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, is_suspended, notify_store_promotions")
    .in("id", linkedIds);

  const allowed = (profiles || [])
    .filter(
      (profile) =>
        profile.is_suspended !== true &&
        profile.notify_store_promotions !== false
    )
    .map((profile) => profile.id as string);

  if (!allowed.length) return { admin, userIds: [] as string[] };

  const { data: tokens } = await admin
    .from("device_push_tokens")
    .select("user_id")
    .in("user_id", allowed)
    .in("app_surface", ["customer", "web"]);

  const withTokens = [
    ...new Set(
      (tokens || [])
        .map((row) => boundUuid(String(row.user_id || "")))
        .filter((id): id is string => Boolean(id))
    ),
  ];

  return { admin, userIds: withTokens };
}

export async function getStoreMessageAudienceAction() {
  const workspace = await getStoreWorkspaceAction();
  if (!workspace?.store?.id || !workspace.canManageStore) {
    return { error: "Only owners and managers can message customers.", count: 0 };
  }
  if (isDemoMode()) {
    return { count: 0, storeId: workspace.store.id, storeName: workspace.store.name };
  }

  const { userIds, error } = await reachableCustomerIds(workspace.store.id);
  if (error) {
    return { error: "Could not load message audience.", count: 0 };
  }

  return {
    count: userIds.length,
    storeId: workspace.store.id,
    storeName: workspace.store.name,
  };
}

export async function sendStoreCustomerMessageAction(input: {
  title: string;
  body: string;
}) {
  const profile = await getCurrentProfile();
  const workspace = await getStoreWorkspaceAction();
  if (!profile || !workspace?.store?.id || !workspace.canManageStore) {
    return { error: "Only owners and managers can message customers." };
  }

  const title = input.title.trim().slice(0, TITLE_MAX);
  const body = input.body.trim().slice(0, BODY_MAX);
  if (title.length < 3) return { error: "Add a short title." };
  if (body.length < 3) return { error: "Add a short message." };

  const limited = await consumeRateLimit({
    bucket: "store-customer-message",
    limit: 10,
    windowMs: 24 * 60 * 60_000,
    key: `${workspace.store.id}:${profile.id}`,
  });
  if (!limited.ok) return { error: limited.error };

  if (isDemoMode()) {
    return { ok: true as const, sent: 0, demo: true as const };
  }

  const { admin, userIds, error } = await reachableCustomerIds(workspace.store.id);
  if (error) return { error: "Could not load customers to message." };

  if (!userIds.length) {
    return {
      error:
        "No reachable customers yet. They need a FINDIT account linked at this store and alerts enabled on their phone or Home Screen app.",
    };
  }

  let sent = 0;
  for (const customerId of userIds) {
    await notifyCustomerDevices({
      admin,
      customerId,
      title,
      body,
      data: {
        type: "store_promotion",
        storeId: workspace.store.id,
        url: "/rewards",
      },
    });
    await admin.from("notifications").insert({
      user_id: customerId,
      type: "store_promotion",
      title,
      body,
      related_store_id: workspace.store.id,
    });
    sent += 1;
  }

  await logSecurityEvent({
    actorId: profile.id,
    action: "store.customer_message",
    resource: workspace.store.id,
    metadata: { title, recipients: sent },
  });

  return { ok: true as const, sent };
}
