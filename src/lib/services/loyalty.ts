"use server";

import {
  boundUuid,
  maskPhoneE164,
  normalizePhoneToE164,
} from "@findit/domain";
import { isDemoMode } from "@/lib/config/env";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/audit";
import { toPublicError } from "@/lib/security/public-error";
import { getCurrentProfile, getStoreWorkspaceAction } from "@/lib/services/actions";
import { resolveHubTerminalAction } from "@/lib/services/hub-devices";
import { getHubClockStateAction } from "@/lib/services/shifts";
import { trackEvent } from "@/lib/services/analytics";

const CUSTOMER_PAGE_SIZE = 25;

export type CustomerLookupResult =
  | { status: "not_found"; maskedPhone: string }
  | {
      status: "found";
      maskedPhone: string;
      displayName: string;
      pointsBalance: number;
      confirmedPurchases: number;
      recentRequest: {
        id: string;
        productName: string;
        createdAt: string;
      } | null;
    }
  | { status: "error"; error: string };

type PurchaseResult =
  | {
      ok: true;
      purchaseId: string;
      pointsAwarded: number;
      pointsBalance: number;
      alreadyConfirmed: boolean;
    }
  | { ok: false; error: string };

type StoreOperator = {
  storeId: string;
  employeeUserId: string | null;
  shiftEmployeeId: string | null;
  hubDeviceId: string | null;
};

function safeCustomerName(profile: {
  first_name?: string | null;
  display_name?: string | null;
}) {
  return (
    profile.first_name?.trim() ||
    profile.display_name?.trim().split(/\s+/)[0] ||
    "FINDIT customer"
  );
}

async function requireStoreOperator(): Promise<
  { ok: true; actor: StoreOperator } | { ok: false; error: string }
> {
  const linked = await resolveHubTerminalAction();
  if (!linked.ok) {
    return { ok: false, error: "Connect this Hub or sign in to a store account." };
  }

  const profile = await getCurrentProfile();
  const clock = await getHubClockStateAction();
  if (clock.required && !clock.clockedIn) {
    return { ok: false, error: "Clock in before confirming a purchase." };
  }

  return {
    ok: true,
    actor: {
      storeId: linked.runtime.store.id,
      employeeUserId: profile?.id || null,
      shiftEmployeeId:
        clock.required && clock.clockedIn ? clock.clockedIn.employeeId : null,
      hubDeviceId: linked.runtime.deviceId,
    },
  };
}

/**
 * Collect an optional loyalty lookup phone without changing email login.
 * A self-reported number is always unverified. When SMS verification is
 * enabled later, only that trusted verification path may set the flags.
 */
export async function saveShopperPhoneAction(
  rawPhone: string
): Promise<
  | {
      ok: true;
      phoneE164: string | null;
      maskedPhone: string | null;
      verified: boolean;
    }
  | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "customer") {
    return { ok: false, error: "Please sign in as a shopper." };
  }

  const trimmed = rawPhone.trim();
  const parsed = trimmed ? normalizePhoneToE164(trimmed) : null;
  if (parsed && !parsed.ok) return { ok: false, error: parsed.error };
  const phoneE164 = parsed?.ok ? parsed.e164 : null;

  const limited = await consumeRateLimit({
    bucket: "profile-phone",
    limit: 10,
    windowMs: 60 * 60_000,
    key: profile.id,
  });
  if (!limited.ok) return { ok: false, error: limited.error };

  if (profile.phone_e164 === phoneE164) {
    return {
      ok: true,
      phoneE164,
      maskedPhone: phoneE164 ? maskPhoneE164(phoneE164) : null,
      verified: Boolean(profile.phone_verified),
    };
  }

  if (isDemoMode()) {
    profile.phone_e164 = phoneE164;
    profile.phone_verified = false;
    profile.phone_verified_at = null;
    return {
      ok: true,
      phoneE164,
      maskedPhone: phoneE164 ? maskPhoneE164(phoneE164) : null,
      verified: false,
    };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { error } = await admin
    .from("profiles")
    .update({
      phone_e164: phoneE164,
      phone_verified: false,
      phone_verified_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "That phone number is already connected to another FINDIT account.",
      };
    }
    return {
      ok: false,
      error: toPublicError(error.message, "Could not save that phone number."),
    };
  }

  void logSecurityEvent({
    actorId: profile.id,
    action: "shopper_phone_changed",
    resource: profile.id,
    metadata: { removed: phoneE164 === null, verified: false },
  });

  return {
    ok: true,
    phoneE164,
    maskedPhone: phoneE164 ? maskPhoneE164(phoneE164) : null,
    verified: false,
  };
}

async function lookupVerifiedCustomer(
  phoneE164: string
): Promise<
  | {
      id: string;
      first_name: string | null;
      display_name: string | null;
    }
  | null
> {
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("profiles")
    .select("id, first_name, display_name")
    .eq("phone_e164", phoneE164)
    .eq("phone_verified", true)
    .eq("account_type", "customer")
    .eq("is_suspended", false)
    .maybeSingle();

  if (!data) return null;

  return data;
}

export async function lookupHubCustomerAction(
  rawPhone: string
): Promise<CustomerLookupResult> {
  const operator = await requireStoreOperator();
  if (!operator.ok) return { status: "error", error: operator.error };

  const parsed = normalizePhoneToE164(rawPhone);
  if (!parsed.ok) return { status: "error", error: parsed.error };

  const limited = await consumeRateLimit({
    bucket: "customer-lookup",
    limit: 40,
    windowMs: 5 * 60_000,
    key: `${operator.actor.storeId}:${operator.actor.employeeUserId || operator.actor.hubDeviceId || "hub"}`,
  });
  if (!limited.ok) return { status: "error", error: limited.error };

  if (isDemoMode()) {
    return { status: "not_found", maskedPhone: maskPhoneE164(parsed.e164) };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const profile = await lookupVerifiedCustomer(parsed.e164);
  const maskedPhone = maskPhoneE164(parsed.e164);

  void trackEvent("customer_lookup", {
    userId: operator.actor.employeeUserId,
    storeId: operator.actor.storeId,
    metadata: { found: Boolean(profile) },
  });

  if (!profile) return { status: "not_found", maskedPhone };

  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const [{ data: relationship }, { data: recent }] = await Promise.all([
    admin
      .from("store_customers")
      .select("points_balance, confirmed_purchases")
      .eq("store_id", operator.actor.storeId)
      .eq("customer_id", profile.id)
      .maybeSingle(),
    admin
      .from("customer_requests")
      .select("id, product_name, created_at")
      .eq("customer_id", profile.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const requestIds = (recent || []).map((row) => row.id);
  let recentRequest: {
    id: string;
    productName: string;
    createdAt: string;
  } | null = null;

  if (requestIds.length) {
    const { data: responses } = await admin
      .from("store_responses")
      .select("request_id")
      .eq("store_id", operator.actor.storeId)
      .in("request_id", requestIds)
      .in("response_type", ["in_stock", "can_order"]);
    const eligible = new Set((responses || []).map((row) => row.request_id));
    const request = (recent || []).find((row) => eligible.has(row.id));
    if (request) {
      recentRequest = {
        id: request.id,
        productName: request.product_name,
        createdAt: request.created_at,
      };
    }
  }

  return {
    status: "found",
    maskedPhone,
    displayName: safeCustomerName(profile),
    pointsBalance: relationship?.points_balance || 0,
    confirmedPurchases: relationship?.confirmed_purchases || 0,
    recentRequest,
  };
}

async function confirmPurchase(input: {
  actor: StoreOperator;
  customerId: string;
  requestId: string | null;
  source: "request" | "phone_lookup";
  operationId: string;
}): Promise<PurchaseResult> {
  const operationId = boundUuid(input.operationId);
  if (!operationId) return { ok: false, error: "Refresh and try again." };

  const limited = await consumeRateLimit({
    bucket: "confirm-purchase",
    limit: 30,
    windowMs: 10 * 60_000,
    key: `${input.actor.storeId}:${input.actor.employeeUserId || input.actor.hubDeviceId || "hub"}`,
  });
  if (!limited.ok) return { ok: false, error: limited.error };

  if (isDemoMode()) {
    return {
      ok: true,
      purchaseId: operationId,
      pointsAwarded: 0,
      pointsBalance: 0,
      alreadyConfirmed: false,
    };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const idempotencyKey =
    input.source === "request"
      ? `request:${input.requestId}`
      : `phone:${operationId}`;

  const { data, error } = await admin.rpc("confirm_store_purchase", {
    p_store_id: input.actor.storeId,
    p_customer_id: input.customerId,
    p_employee_user_id: input.actor.employeeUserId,
    p_shift_employee_id: input.actor.shiftEmployeeId,
    p_hub_device_id: input.actor.hubDeviceId,
    p_request_id: input.requestId,
    p_source: input.source,
    p_idempotency_key: idempotencyKey,
  });

  if (error || !data?.[0]) {
    const message = error?.message || "";
    if (
      message.includes("already") ||
      message.includes("duplicate") ||
      message.includes("unique")
    ) {
      return { ok: false, error: "This purchase was already confirmed." };
    }
    if (message.includes("not eligible")) {
      return { ok: false, error: "This customer or request is not eligible." };
    }
    console.error("[FINDIT] purchase confirmation failed", {
      storeId: input.actor.storeId,
      source: input.source,
      message,
    });
    return { ok: false, error: "Could not confirm this purchase. Try again." };
  }

  const row = data[0] as {
    purchase_id: string;
    points_awarded: number;
    points_balance: number;
    already_confirmed: boolean;
  };

  void Promise.all([
    trackEvent("purchase_confirmed", {
      userId: input.actor.employeeUserId,
      storeId: input.actor.storeId,
      requestId: input.requestId,
      metadata: {
        source: input.source,
        points: row.points_awarded,
        duplicate: row.already_confirmed,
      },
    }),
    row.points_awarded > 0
      ? trackEvent("points_awarded", {
          userId: input.customerId,
          storeId: input.actor.storeId,
          requestId: input.requestId,
          metadata: { points: row.points_awarded },
        })
      : Promise.resolve(),
    logSecurityEvent({
      actorId: input.actor.employeeUserId,
      action: "purchase_confirmed",
      resource: row.purchase_id,
      metadata: {
        storeId: input.actor.storeId,
        source: input.source,
        points: row.points_awarded,
        shiftEmployeeId: input.actor.shiftEmployeeId,
        hubDeviceId: input.actor.hubDeviceId,
      },
    }),
  ]);

  return {
    ok: true,
    purchaseId: row.purchase_id,
    pointsAwarded: row.points_awarded,
    pointsBalance: row.points_balance,
    alreadyConfirmed: row.already_confirmed,
  };
}

export async function confirmLookupPurchaseAction(input: {
  phone: string;
  operationId: string;
}): Promise<PurchaseResult> {
  const operator = await requireStoreOperator();
  if (!operator.ok) return { ok: false, error: operator.error };
  const parsed = normalizePhoneToE164(input.phone);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const customer = await lookupVerifiedCustomer(parsed.e164);
  if (!customer) {
    return { ok: false, error: "No verified FINDIT customer found." };
  }
  return confirmPurchase({
    actor: operator.actor,
    customerId: customer.id,
    requestId: null,
    source: "phone_lookup",
    operationId: input.operationId,
  });
}

export async function confirmRequestPurchaseAction(input: {
  requestId: string;
  operationId: string;
}): Promise<PurchaseResult> {
  const requestId = boundUuid(input.requestId);
  if (!requestId) return { ok: false, error: "Request not found." };
  const operator = await requireStoreOperator();
  if (!operator.ok) return { ok: false, error: operator.error };

  if (isDemoMode()) {
    return confirmPurchase({
      actor: operator.actor,
      customerId: "00000000-0000-4000-8000-000000000001",
      requestId,
      source: "request",
      operationId: input.operationId,
    });
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: request } = await admin
    .from("customer_requests")
    .select("customer_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { ok: false, error: "Request not found." };

  return confirmPurchase({
    actor: operator.actor,
    customerId: request.customer_id,
    requestId,
    source: "request",
    operationId: input.operationId,
  });
}

type CustomerCursor = { at: string; id: string };

function encodeCursor(cursor: CustomerCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value?: string): CustomerCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as CustomerCursor;
    if (
      !boundUuid(parsed.id) ||
      !parsed.at ||
      !Number.isFinite(new Date(parsed.at).getTime())
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getStoreCustomersAction(cursorValue?: string) {
  const profile = await getCurrentProfile();
  const workspace = await getStoreWorkspaceAction();
  if (!profile || !workspace?.store?.id || !workspace.canManageStore) {
    return { error: "Only owners and managers can view customers.", rows: [], nextCursor: null };
  }
  if (isDemoMode()) return { rows: [], nextCursor: null };

  const cursor = decodeCursor(cursorValue);
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  let query = admin
    .from("store_customers")
    .select(
      "id, points_balance, lifetime_points, confirmed_purchases, marketing_opt_in, first_seen_at, last_seen_at, customer:profiles(first_name, display_name)"
    )
    .eq("store_id", workspace.store.id)
    .not("customer_id", "is", null)
    .order("last_seen_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CUSTOMER_PAGE_SIZE + 1);

  if (cursor) {
    query = query.or(
      `last_seen_at.lt.${cursor.at},and(last_seen_at.eq.${cursor.at},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error) {
    return { error: "Could not load customers.", rows: [], nextCursor: null };
  }
  const all = data || [];
  const hasMore = all.length > CUSTOMER_PAGE_SIZE;
  const page = all.slice(0, CUSTOMER_PAGE_SIZE);
  const last = page[page.length - 1];

  return {
    rows: page.map((row) => {
      const customer = Array.isArray(row.customer)
        ? row.customer[0]
        : row.customer;
      return {
        id: row.id,
        displayName: safeCustomerName(customer || {}),
        pointsBalance: row.points_balance,
        lifetimePoints: row.lifetime_points,
        confirmedPurchases: row.confirmed_purchases,
        marketingOptIn: row.marketing_opt_in,
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at,
      };
    }),
    nextCursor:
      hasMore && last
        ? encodeCursor({ at: last.last_seen_at, id: last.id })
        : null,
  };
}

export async function getStoreRewardSettingsAction() {
  const workspace = await getStoreWorkspaceAction();
  if (!workspace?.store?.id || !workspace.canManageStore) return null;
  if (isDemoMode()) {
    return {
      storeId: workspace.store.id,
      enabled: false,
      pointsPerPurchase: 10,
      rewardThresholdPoints: 100,
      rewardValueCents: 500,
    };
  }
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("store_reward_settings")
    .select("*")
    .eq("store_id", workspace.store.id)
    .maybeSingle();
  return {
    storeId: workspace.store.id,
    enabled: data?.enabled ?? false,
    pointsPerPurchase: data?.points_per_purchase ?? 10,
    rewardThresholdPoints: data?.reward_threshold_points ?? 100,
    rewardValueCents: data?.reward_value_cents ?? 500,
  };
}

export async function updateStoreRewardSettingsAction(input: {
  enabled: boolean;
  pointsPerPurchase: number;
  rewardThresholdPoints: number;
  rewardValueCents: number;
}) {
  const profile = await getCurrentProfile();
  const workspace = await getStoreWorkspaceAction();
  if (!profile || !workspace?.store?.id || !workspace.canManageStore) {
    return { ok: false as const, error: "Only owners and managers can change rewards." };
  }
  const values = [
    input.pointsPerPurchase,
    input.rewardThresholdPoints,
    input.rewardValueCents,
  ];
  if (!values.every(Number.isInteger)) {
    return { ok: false as const, error: "Use whole numbers for reward settings." };
  }
  if (
    input.pointsPerPurchase < 1 ||
    input.pointsPerPurchase > 1000 ||
    input.rewardThresholdPoints < 1 ||
    input.rewardThresholdPoints > 1_000_000 ||
    input.rewardValueCents < 0 ||
    input.rewardValueCents > 1_000_000
  ) {
    return { ok: false as const, error: "Check the reward amounts and try again." };
  }

  if (!isDemoMode()) {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const { error } = await admin.from("store_reward_settings").upsert({
      store_id: workspace.store.id,
      enabled: input.enabled,
      points_per_purchase: input.pointsPerPurchase,
      reward_threshold_points: input.rewardThresholdPoints,
      reward_value_cents: input.rewardValueCents,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false as const, error: "Could not save reward settings." };
  }

  void logSecurityEvent({
    actorId: profile.id,
    action: "store_rewards_updated",
    resource: workspace.store.id,
    metadata: {
      enabled: input.enabled,
      pointsPerPurchase: input.pointsPerPurchase,
      rewardThresholdPoints: input.rewardThresholdPoints,
      rewardValueCents: input.rewardValueCents,
    },
  });
  return { ok: true as const };
}

export async function getMyStoreRewardsAction() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "customer") return [];
  if (isDemoMode()) return [];
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("store_customers")
    .select(
      "id, points_balance, lifetime_points, confirmed_purchases, last_seen_at, store:stores(id, name, slug)"
    )
    .eq("customer_id", profile.id)
    .order("last_seen_at", { ascending: false })
    .limit(50);
  return data || [];
}
