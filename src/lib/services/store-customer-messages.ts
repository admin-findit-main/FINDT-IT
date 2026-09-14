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

function formatStoreAddress(store: {
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}) {
  const street = (store.street_address || "").trim();
  const city = (store.city || "").trim();
  const state = (store.state || "").trim();
  const zip = (store.postal_code || "").trim();
  const cityLine = [city, state].filter(Boolean).join(", ");
  const withZip = [cityLine, zip].filter(Boolean).join(" ");
  return [street, withZip].filter(Boolean).join(" · ");
}

function brandedPromotionCopy(input: {
  storeName: string;
  title: string;
  body: string;
  address: string;
}) {
  const storeName = input.storeName.trim() || "Your store";
  const titlePrefix = `${storeName}: `;
  const room = Math.max(12, TITLE_MAX - titlePrefix.length);
  const titleCore = input.title.trim().slice(0, room);
  const title = `${titlePrefix}${titleCore}`.slice(0, TITLE_MAX);

  const addressLine = input.address ? `\n\n— ${storeName}\n${input.address}` : `\n\n— ${storeName}`;
  const bodyCoreMax = Math.max(20, BODY_MAX - addressLine.length);
  const body = `${input.body.trim().slice(0, bodyCoreMax)}${addressLine}`.slice(
    0,
    BODY_MAX + 80
  );

  return { title, body, storeName };
}

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

  const rawTitle = input.title.trim().slice(0, TITLE_MAX);
  const rawBody = input.body.trim().slice(0, BODY_MAX);
  if (rawTitle.length < 3) return { error: "Add a short title." };
  if (rawBody.length < 3) return { error: "Add a short message." };

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

  const store = workspace.store;
  const branded = brandedPromotionCopy({
    storeName: store.name,
    title: rawTitle,
    body: rawBody,
    address: formatStoreAddress(store),
  });

  const { admin, userIds, error } = await reachableCustomerIds(store.id);
  if (error) return { error: "Could not load customers to message." };

  if (!userIds.length) {
    return {
      error:
        "No reachable customers yet. They need a FINDIT account linked at this store and alerts enabled on their phone or Home Screen app.",
    };
  }

  let sent = 0;
  for (const customerId of userIds) {
    const { data: inserted } = await admin
      .from("notifications")
      .insert({
        user_id: customerId,
        type: "store_promotion",
        title: branded.title,
        body: branded.body,
        related_store_id: store.id,
      })
      .select("id")
      .single();

    const notificationId = boundUuid(String(inserted?.id || "")) || undefined;
    await notifyCustomerDevices({
      admin,
      customerId,
      title: branded.title,
      body: branded.body,
      data: {
        type: "store_promotion",
        storeId: store.id,
        storeName: branded.storeName,
        ...(notificationId ? { notificationId } : {}),
        url: notificationId
          ? `/notifications/${notificationId}`
          : `/stores/${store.slug || store.id}`,
      },
    });
    sent += 1;
  }

  await logSecurityEvent({
    actorId: profile.id,
    action: "store.customer_message",
    resource: store.id,
    metadata: { title: branded.title, recipients: sent },
  });

  return { ok: true as const, sent };
}
