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

export async function getStoreMessageAudienceAction() {
  const workspace = await getStoreWorkspaceAction();
  if (!workspace?.store?.id || !workspace.canManageStore) {
    return { error: "Only owners and managers can message customers.", count: 0 };
  }
  if (isDemoMode()) {
    return { count: 0, storeId: workspace.store.id, storeName: workspace.store.name };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("store_customers")
    .select("customer_id, marketing_opt_in, customer:profiles!inner(id, notify_store_promotions, is_suspended)")
    .eq("store_id", workspace.store.id)
    .is("removed_at", null)
    .not("customer_id", "is", null)
    .eq("marketing_opt_in", true);

  const eligible = (data || []).filter((row) => {
    const profile = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    return (
      profile &&
      profile.notify_store_promotions === true &&
      profile.is_suspended !== true
    );
  });

  return {
    count: eligible.length,
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

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("store_customers")
    .select(
      "customer_id, marketing_opt_in, customer:profiles!inner(id, notify_store_promotions, is_suspended)"
    )
    .eq("store_id", workspace.store.id)
    .is("removed_at", null)
    .not("customer_id", "is", null)
    .eq("marketing_opt_in", true);

  const userIds = [
    ...new Set(
      (data || [])
        .map((row) => {
          const customer = Array.isArray(row.customer)
            ? row.customer[0]
            : row.customer;
          if (
            !customer ||
            customer.notify_store_promotions !== true ||
            customer.is_suspended === true
          ) {
            return null;
          }
          return boundUuid(String(row.customer_id || customer.id || ""));
        })
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (!userIds.length) {
    return {
      error:
        "No reachable customers yet. Shoppers must opt in to store promotions and install FINDIT alerts.",
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
