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
import type { createServiceClient } from "@/lib/supabase/admin";

const TITLE_MAX = 80;
const BODY_MAX = 240;
const IN_CHUNK = 200;

type ServiceAdmin = ReturnType<typeof createServiceClient>;

type LinkedCustomerRow = {
  customer_id: string | null;
  customer:
    | { id: string; is_suspended: boolean }
    | { id: string; is_suspended: boolean }[]
    | null;
};

/**
 * Pilot audience rules
 * --------------------
 * Migration `20260907194000_loyalty_security_and_atomic_purchase` set both
 * `store_customers.marketing_opt_in` and `profiles.notify_store_promotions` to
 * DEFAULT false and mass-reset existing true → false (no affirmative consent
 * evidence). Requiring dual opt-in therefore reaches nobody.
 *
 * Reach (pilot): linked, non-removed store customers who are not suspended and
 * have at least one customer/web push token — same token gate as admin push.
 * `marketing_opt_in` is NOT NULL; default/false alone does not block when tokens
 * exist (treat missing affirmative marketing carefully — do not require true).
 *
 * Hard opt-out: `notify_store_promotions === false` is the intended global
 * promotions kill-switch. Because the column is NOT NULL DEFAULT false after the
 * consent reset, requiring === true empties the audience; for pilot we do not
 * require === true. Suspended accounts are always skipped. Phone-only Hub rows
 * (null customer_id) stay out.
 */
async function reachableStoreCustomerIds(
  admin: ServiceAdmin,
  storeId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("store_customers")
    .select(
      "customer_id, customer:profiles!store_customers_customer_id_fkey(id, is_suspended)"
    )
    .eq("store_id", storeId)
    .is("removed_at", null)
    .not("customer_id", "is", null);

  if (error) {
    console.error("[FINDIT] store message audience query failed", error.message);
    return [];
  }

  const candidateIds = [
    ...new Set(
      ((data || []) as LinkedCustomerRow[])
        .map((row) => {
          const profile = Array.isArray(row.customer)
            ? row.customer[0]
            : row.customer;
          if (!profile || profile.is_suspended === true) return null;
          // Pilot: ignore notify_store_promotions / marketing_opt_in gates.
          // Both default false after the consent migration; requiring dual-true
          // blocks every linked shopper. Token presence is the reachability gate.
          // When consent UX is affirmative again, treat notify_store_promotions
          // === false as a hard opt-out here before the token intersect.
          return boundUuid(String(row.customer_id || profile.id || ""));
        })
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (!candidateIds.length) return [];

  const withTokens = new Set<string>();
  for (let i = 0; i < candidateIds.length; i += IN_CHUNK) {
    const slice = candidateIds.slice(i, i + IN_CHUNK);
    const { data: tokens } = await admin
      .from("device_push_tokens")
      .select("user_id")
      .in("user_id", slice)
      .in("app_surface", ["customer", "web"]);
    for (const row of tokens || []) {
      if (row.user_id) withTokens.add(String(row.user_id));
    }
  }

  return candidateIds.filter((id) => withTokens.has(id));
}

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
  const userIds = await reachableStoreCustomerIds(admin, workspace.store.id);

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

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const userIds = await reachableStoreCustomerIds(admin, workspace.store.id);

  if (!userIds.length) {
    return {
      error:
        "No reachable customers yet. Linked shoppers need the FINDIT app (or web alerts) installed — phone-only Hub rows cannot get push.",
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
    // notifications.type is unconstrained text (init migration) — same as admin_broadcast.
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
