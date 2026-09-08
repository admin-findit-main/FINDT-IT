"use server";

import { createHmac } from "node:crypto";
import {
  boundUuid,
  maskPhoneE164,
  normalizePhoneToE164,
} from "@findit/domain";
import { isDemoMode } from "@/lib/config/env";
import {
  estimateHubPoints,
  MAX_HUB_AMOUNT_CENTS,
} from "@/lib/hub/amount";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/audit";
import { toPublicError } from "@/lib/security/public-error";
import { getCurrentProfile, getStoreWorkspaceAction } from "@/lib/services/actions";
import { resolveHubTerminalAction } from "@/lib/services/hub-devices";
import { hasVerifiedEmailIdentity } from "@/lib/services/hub-policy";
import { getHubClockStateAction } from "@/lib/services/shifts";
import { trackEvent } from "@/lib/services/analytics";

const CUSTOMER_PAGE_SIZE = 25;

export type CustomerLookupResult =
  | { status: "not_found"; maskedPhone: string }
  | {
      status: "found";
      maskedPhone: string;
      maskedEmail: string;
      displayName: string;
      pointsBalance: number;
      pointsPerDollar: number;
      rewardsEnabled: boolean;
      memberSince: string | null;
    }
  | {
      status: "pending";
      maskedPhone: string;
      displayName: "Store rewards customer";
      pointsBalance: number;
      pointsPerDollar: number;
      rewardsEnabled: boolean;
      memberSince: string | null;
      storeOnly: true;
    }
  | { status: "error"; error: string };

type PurchaseResult =
  | {
      ok: true;
      pointsAwarded: number;
      pointsBalance: number;
      alreadyConfirmed: boolean;
    }
  | { ok: false; error: string };

type PendingCustomerResult =
  | {
      ok: true;
      customer: Extract<CustomerLookupResult, { status: "pending" }>;
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

function maskEmail(email: string | null | undefined) {
  if (!email) return "Contact unavailable";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Contact unavailable";
  return `${local.slice(0, 1)}***@${domain}`;
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

  let employeeUserId: string | null = null;
  if (profile) {
    if (profile.id === linked.runtime.store.owner_id) {
      employeeUserId = profile.id;
    } else if (isDemoMode()) {
      const { getDemoState } = await import("@/lib/demo/store");
      employeeUserId = getDemoState().storeMembers.some(
        (member) =>
          member.store_id === linked.runtime.store.id &&
          member.user_id === profile.id &&
          member.status === "active"
      )
        ? profile.id
        : null;
    } else {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      const { data: membership } = await admin
        .from("store_members")
        .select("id")
        .eq("store_id", linked.runtime.store.id)
        .eq("user_id", profile.id)
        .eq("status", "active")
        .maybeSingle();
      employeeUserId = membership ? profile.id : null;
    }
  }

  return {
    ok: true,
    actor: {
      storeId: linked.runtime.store.id,
      employeeUserId,
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

async function lookupCustomerByPhone(rawPhone: string): Promise<
  | {
      customer: {
        id: string;
        first_name: string | null;
        display_name: string | null;
        email: string | null;
        phone_e164: string;
      } | null;
      maskedPhone: string;
    }
  | { error: string }
> {
  const parsed = normalizePhoneToE164(rawPhone);
  if (!parsed.ok) return { error: parsed.error };
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, first_name, display_name, email, phone_e164")
    .eq("phone_e164", parsed.e164)
    .eq("account_type", "customer")
    .eq("is_suspended", false)
    .maybeSingle();
  if (error) return { error: "Could not look up that customer." };

  // A self-reported phone is allowed as an exact lookup identifier only after
  // the account's email identity has been verified. It is never treated as
  // phone ownership, authentication, recovery, or other security proof.
  let customer = data?.phone_e164 ? data : null;
  if (customer) {
    const { data: authData, error: authError } =
      await admin.auth.admin.getUserById(customer.id);
    if (authError) return { error: "Could not look up that customer." };
    if (!hasVerifiedEmailIdentity(authData.user)) customer = null;
  }

  return {
    customer,
    maskedPhone: maskPhoneE164(parsed.e164),
  };
}

type PendingRelationshipRow = {
  points_balance: number;
  first_seen_at: string | null;
};

function pendingCustomer(
  maskedPhone: string,
  row: PendingRelationshipRow,
  pointsPerDollar: number,
  rewardsEnabled: boolean
): Extract<CustomerLookupResult, { status: "pending" }> {
  return {
    status: "pending",
    maskedPhone,
    displayName: "Store rewards customer",
    pointsBalance: row.points_balance || 0,
    pointsPerDollar,
    rewardsEnabled,
    memberSince: row.first_seen_at || null,
    storeOnly: true,
  };
}

async function lookupPendingCustomer(input: {
  storeId: string;
  phoneE164: string;
  maskedPhone: string;
  pointsPerDollar?: number;
  rewardsEnabled?: boolean;
}): Promise<
  | {
      customer: Extract<CustomerLookupResult, { status: "pending" }> | null;
      relationshipId: string | null;
    }
  | { error: string }
> {
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: claim, error: claimError } = await admin
    .from("store_customer_claims")
    .select("store_customer_id")
    .eq("store_id", input.storeId)
    .eq("phone_e164", input.phoneE164)
    .is("claimed_at", null)
    .maybeSingle();
  if (claimError) return { error: "Could not look up that customer." };
  if (!claim) {
    return { customer: null, relationshipId: null };
  }
  const { data: row, error: relationshipError } = await admin
    .from("store_customers")
    .select("points_balance, first_seen_at")
    .eq("id", claim.store_customer_id)
    .eq("store_id", input.storeId)
    .is("customer_id", null)
    .is("removed_at", null)
    .maybeSingle();
  if (relationshipError) return { error: "Could not look up that customer." };
  return {
    customer: row
      ? pendingCustomer(
          input.maskedPhone,
          row,
          input.pointsPerDollar ?? 1,
          input.rewardsEnabled ?? false
        )
      : null,
    relationshipId: row ? claim.store_customer_id : null,
  };
}

export async function lookupHubCustomerAction(
  rawPhone: string
): Promise<CustomerLookupResult> {
  const operator = await requireStoreOperator();
  if (!operator.ok) return { status: "error", error: operator.error };

  const limited = await consumeRateLimit({
    bucket: "customer-lookup",
    limit: 40,
    windowMs: 5 * 60_000,
    key: `${operator.actor.storeId}:${operator.actor.employeeUserId || operator.actor.hubDeviceId || "hub"}`,
  });
  if (!limited.ok) return { status: "error", error: limited.error };

  if (isDemoMode()) {
    return { status: "not_found", maskedPhone: "Customer not found" };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const [{ data: rewardSettings }, lookup] = await Promise.all([
    admin
      .from("store_reward_settings")
      .select("enabled, points_per_dollar")
      .eq("store_id", operator.actor.storeId)
      .maybeSingle(),
    lookupCustomerByPhone(rawPhone),
  ]);
  const pointsPerDollar = Math.max(
    1,
    Number(rewardSettings?.points_per_dollar) || 1
  );
  const rewardsEnabled = rewardSettings?.enabled ?? false;
  if ("error" in lookup) return { status: "error", error: lookup.error };
  const profile = lookup.customer;
  const maskedPhone = lookup.maskedPhone;

  void trackEvent("customer_lookup", {
    userId: operator.actor.employeeUserId,
    storeId: operator.actor.storeId,
    metadata: { found: Boolean(profile) },
  });

  if (!profile) {
    const parsed = normalizePhoneToE164(rawPhone);
    if (!parsed.ok) return { status: "error", error: parsed.error };
    const pending = await lookupPendingCustomer({
      storeId: operator.actor.storeId,
      phoneE164: parsed.e164,
      maskedPhone,
      pointsPerDollar,
      rewardsEnabled,
    });
    if ("error" in pending) {
      return { status: "error", error: pending.error };
    }
    return pending.customer || { status: "not_found", maskedPhone };
  }

  const { data: relationship, error: relationshipError } = await admin
    .from("store_customers")
    .select("points_balance, first_seen_at")
    .eq("store_id", operator.actor.storeId)
    .eq("customer_id", profile.id)
    .maybeSingle();
  if (relationshipError) {
    return { status: "error", error: "Could not look up that customer." };
  }

  return {
    status: "found",
    maskedPhone,
    maskedEmail: maskEmail(profile.email),
    displayName: safeCustomerName(profile),
    pointsBalance: relationship?.points_balance || 0,
    pointsPerDollar,
    rewardsEnabled,
    memberSince: relationship?.first_seen_at || null,
  };
}

function pendingOperationId(value: string) {
  const operationId = boundUuid(value);
  return operationId ? `pending:${operationId}` : null;
}

function internalPendingClaimHash(phoneE164: string, operationId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Pending rewards HMAC secret is unavailable.");
  }
  return createHmac(
    "sha256",
    secret
  )
    .update(`${phoneE164}:${operationId}`)
    .digest("hex");
}

export async function createPendingStoreCustomerAction(input: {
  phone: string;
  operationId: string;
}): Promise<PendingCustomerResult> {
  const operator = await requireStoreOperator();
  if (!operator.ok) return { ok: false, error: operator.error };
  const operationId = pendingOperationId(input.operationId);
  if (!operationId) return { ok: false, error: "Refresh and try again." };

  const parsed = normalizePhoneToE164(input.phone);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const limited = await consumeRateLimit({
    bucket: "customer-lookup",
    limit: 10,
    windowMs: 10 * 60_000,
    key: `${operator.actor.storeId}:${operator.actor.employeeUserId || operator.actor.hubDeviceId || "hub"}`,
  });
  if (!limited.ok) return { ok: false, error: limited.error };

  const registered = await lookupCustomerByPhone(parsed.e164);
  if ("error" in registered) return { ok: false, error: registered.error };
  if (registered.customer) {
    return {
      ok: false,
      error: "A FINDIT account is already connected to this phone number.",
    };
  }

  if (isDemoMode()) {
    return {
      ok: true,
      customer: pendingCustomer(maskPhoneE164(parsed.e164), {
        points_balance: 0,
        first_seen_at: new Date().toISOString(),
      }, 1, true),
    };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const claimCodeHash = internalPendingClaimHash(parsed.e164, operationId);
  const { data, error } = await admin.rpc(
    "create_or_get_pending_store_customer",
    {
      p_store_id: operator.actor.storeId,
      p_phone_e164: parsed.e164,
      p_claim_code_hash: claimCodeHash,
      p_create_idempotency_key: operationId,
      p_employee_user_id: operator.actor.employeeUserId,
      p_shift_employee_id: operator.actor.shiftEmployeeId,
      p_hub_device_id: operator.actor.hubDeviceId,
    }
  );
  const row = data?.[0] as
    | {
        pending_store_customer_id: string;
        created: boolean;
      }
    | undefined;
  if (error || !row) {
    return { ok: false, error: "Could not create store rewards. Try again." };
  }
  const { data: relationship, error: relationshipError } = await admin
    .from("store_customers")
    .select("points_balance, first_seen_at")
    .eq("id", row.pending_store_customer_id)
    .eq("store_id", operator.actor.storeId)
    .is("customer_id", null)
    .is("removed_at", null)
    .maybeSingle();
  if (relationshipError || !relationship) {
    return { ok: false, error: "Could not create store rewards. Try again." };
  }
  const { data: rewardSettings } = await admin
    .from("store_reward_settings")
    .select("enabled, points_per_dollar")
    .eq("store_id", operator.actor.storeId)
    .maybeSingle();

  void logSecurityEvent({
    actorId: operator.actor.employeeUserId,
    action: "pending_store_customer_created",
    resource: operator.actor.storeId,
    metadata: {
      storeId: operator.actor.storeId,
      pendingCreated: row.created,
      shiftEmployeeId: operator.actor.shiftEmployeeId,
      hubDeviceId: operator.actor.hubDeviceId,
    },
  });
  return {
    ok: true,
    customer: pendingCustomer(
      maskPhoneE164(parsed.e164),
      relationship,
      Math.max(1, Number(rewardSettings?.points_per_dollar) || 1),
      rewardSettings?.enabled ?? false
    ),
  };
}

async function confirmPurchase(input: {
  actor: StoreOperator;
  customerId: string;
  requestId: string | null;
  source: "request" | "phone_lookup";
  operationId: string;
  amountCents?: number;
}): Promise<PurchaseResult> {
  const operationId = boundUuid(input.operationId);
  if (!operationId) return { ok: false, error: "Refresh and try again." };
  if (
    input.source === "phone_lookup" &&
    (!Number.isInteger(input.amountCents) ||
      input.amountCents! < 1 ||
      input.amountCents! > MAX_HUB_AMOUNT_CENTS)
  ) {
    return { ok: false, error: "Enter a valid purchase amount." };
  }

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
      pointsAwarded:
        input.source === "phone_lookup"
          ? estimateHubPoints(input.amountCents || 0, 1)
          : 0,
      pointsBalance:
        input.source === "phone_lookup"
          ? estimateHubPoints(input.amountCents || 0, 1)
          : 0,
      alreadyConfirmed: false,
    };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const idempotencyKey =
    input.source === "request"
      ? `request:${input.requestId}`
      : `phone:${operationId}`;

  const { data, error } =
    input.source === "request"
      ? await admin.rpc("confirm_store_purchase", {
          p_store_id: input.actor.storeId,
          p_customer_id: input.customerId,
          p_employee_user_id: input.actor.employeeUserId,
          p_shift_employee_id: input.actor.shiftEmployeeId,
          p_hub_device_id: input.actor.hubDeviceId,
          p_request_id: input.requestId,
          p_source: input.source,
          p_idempotency_key: idempotencyKey,
        })
      : await admin.rpc("confirm_hub_amount_purchase", {
          p_store_id: input.actor.storeId,
          p_customer_id: input.customerId,
          p_amount_cents: input.amountCents,
          p_employee_user_id: input.actor.employeeUserId,
          p_shift_employee_id: input.actor.shiftEmployeeId,
          p_hub_device_id: input.actor.hubDeviceId,
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
        amountCents: input.amountCents ?? null,
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
    pointsAwarded: row.points_awarded,
    pointsBalance: row.points_balance,
    alreadyConfirmed: row.already_confirmed,
  };
}

export async function confirmLookupPurchaseAction(input: {
  phone: string;
  operationId: string;
  amountCents: number;
}): Promise<PurchaseResult> {
  const operator = await requireStoreOperator();
  if (!operator.ok) return { ok: false, error: operator.error };
  const lookup = await lookupCustomerByPhone(input.phone);
  if ("error" in lookup) return { ok: false, error: lookup.error };
  const customer = lookup.customer;
  if (!customer) {
    return { ok: false, error: "No FINDIT customer found." };
  }
  return confirmPurchase({
    actor: operator.actor,
    customerId: customer.id,
    requestId: null,
    source: "phone_lookup",
    operationId: input.operationId,
    amountCents: input.amountCents,
  });
}

export async function confirmPendingPurchaseAction(input: {
  phone: string;
  operationId: string;
  amountCents: number;
}): Promise<PurchaseResult> {
  const operator = await requireStoreOperator();
  if (!operator.ok) return { ok: false, error: operator.error };
  const operationId = boundUuid(input.operationId);
  if (!operationId) return { ok: false, error: "Refresh and try again." };
  if (
    !Number.isInteger(input.amountCents) ||
    input.amountCents < 1 ||
    input.amountCents > MAX_HUB_AMOUNT_CENTS
  ) {
    return { ok: false, error: "Enter a valid purchase amount." };
  }
  const parsed = normalizePhoneToE164(input.phone);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const limited = await consumeRateLimit({
    bucket: "confirm-purchase",
    limit: 30,
    windowMs: 10 * 60_000,
    key: `${operator.actor.storeId}:${operator.actor.employeeUserId || operator.actor.hubDeviceId || "hub"}`,
  });
  if (!limited.ok) return { ok: false, error: limited.error };

  if (isDemoMode()) {
    const points = estimateHubPoints(input.amountCents, 1);
    return {
      ok: true,
      pointsAwarded: points,
      pointsBalance: points,
      alreadyConfirmed: false,
    };
  }
  const pending = await lookupPendingCustomer({
    storeId: operator.actor.storeId,
    phoneE164: parsed.e164,
    maskedPhone: maskPhoneE164(parsed.e164),
  });
  if ("error" in pending) return { ok: false, error: pending.error };
  if (!pending.relationshipId) {
    return { ok: false, error: "Store rewards were not found." };
  }
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data, error } = await admin.rpc("confirm_pending_store_amount_purchase", {
    p_store_id: operator.actor.storeId,
    p_store_customer_id: pending.relationshipId,
    p_amount_cents: input.amountCents,
    p_employee_user_id: operator.actor.employeeUserId,
    p_shift_employee_id: operator.actor.shiftEmployeeId,
    p_hub_device_id: operator.actor.hubDeviceId,
    p_idempotency_key: `phone:${operationId}`,
  });
  const row = data?.[0] as
    | {
        purchase_id: string;
        points_awarded: number;
        points_balance: number;
        already_confirmed: boolean;
      }
    | undefined;
  if (error || !row) {
    return { ok: false, error: "Could not confirm this purchase. Try again." };
  }
  void logSecurityEvent({
    actorId: operator.actor.employeeUserId,
    action: "pending_purchase_confirmed",
    resource: row.purchase_id,
    metadata: {
      storeId: operator.actor.storeId,
      points: row.points_awarded,
      amountCents: input.amountCents,
      shiftEmployeeId: operator.actor.shiftEmployeeId,
      hubDeviceId: operator.actor.hubDeviceId,
    },
  });
  return {
    ok: true,
    pointsAwarded: row.points_awarded,
    pointsBalance: row.points_balance,
    alreadyConfirmed: row.already_confirmed,
  };
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

export type HubHistoryItem =
  | {
      kind: "purchase";
      productName: string | null;
      customerFirstName: string;
      points: number;
      responseType: null;
      timestamp: string;
      employeeDisplayName: string | null;
      source: "request" | "phone_lookup" | "hub_phone_pending";
      status: "confirmed" | "reversed";
    }
  | {
      kind: "request_answer";
      productName: string;
      customerFirstName: string;
      points: null;
      responseType: "in_stock" | "out_of_stock" | "can_order" | "not_relevant";
      timestamp: string;
      employeeDisplayName: string | null;
    };

type HistoryProfile = {
  id: string;
  first_name: string | null;
  display_name: string | null;
};

function historyDisplayName(profile: HistoryProfile | undefined) {
  if (!profile) return null;
  return (
    profile.display_name?.trim() ||
    profile.first_name?.trim() ||
    null
  );
}

export async function getHubHistoryAction(): Promise<{
  rows: HubHistoryItem[];
  error?: string;
}> {
  const operator = await requireStoreOperator();
  if (!operator.ok) return { rows: [], error: operator.error };
  if (isDemoMode()) return { rows: [] };

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const [{ data: purchases, error: purchaseError }, { data: responses, error: responseError }] =
    await Promise.all([
      admin
        .from("store_purchases")
        .select(
          "customer_id, employee_user_id, shift_employee_id, hub_device_id, request_id, source, points_awarded, status, confirmed_at"
        )
        .eq("store_id", operator.actor.storeId)
        .order("confirmed_at", { ascending: false })
        .limit(60),
      admin
        .from("store_responses")
        .select("request_id, responded_by, response_type, created_at")
        .eq("store_id", operator.actor.storeId)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

  if (purchaseError || responseError) {
    console.error("[FINDIT] Hub history query failed", {
      storeId: operator.actor.storeId,
      purchaseCode: purchaseError?.code,
      responseCode: responseError?.code,
    });
    return { rows: [], error: "Could not load Hub history." };
  }

  const purchaseRows = purchases || [];
  const responseRows = responses || [];
  const requestIds = Array.from(
    new Set(
      [...purchaseRows, ...responseRows]
        .map((row) => row.request_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const profileIds = Array.from(
    new Set(
      [
        ...purchaseRows.flatMap((row) => [
          row.customer_id,
          row.employee_user_id,
        ]),
        ...responseRows.map((row) => row.responded_by),
      ].filter((id): id is string => Boolean(id))
    )
  );
  const shiftIds = Array.from(
    new Set(
      purchaseRows
        .map((row) => row.shift_employee_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const deviceIds = Array.from(
    new Set(
      purchaseRows
        .map((row) => row.hub_device_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const [requestResult, profileResult, shiftResult, deviceResult] =
    await Promise.all([
      requestIds.length
        ? admin
            .from("customer_requests")
            .select("id, customer_id, product_name")
            .in("id", requestIds)
        : Promise.resolve({ data: [], error: null }),
      profileIds.length
        ? admin
            .from("profiles")
            .select("id, first_name, display_name")
            .in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
      shiftIds.length
        ? admin
            .from("store_shift_employees")
            .select("id, display_name")
            .eq("store_id", operator.actor.storeId)
            .in("id", shiftIds)
        : Promise.resolve({ data: [], error: null }),
      deviceIds.length
        ? admin
            .from("store_devices")
            .select("id, device_name")
            .eq("store_id", operator.actor.storeId)
            .in("id", deviceIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (
    requestResult.error ||
    profileResult.error ||
    shiftResult.error ||
    deviceResult.error
  ) {
    return { rows: [], error: "Could not load Hub history." };
  }

  const requestById = new Map(
    (requestResult.data || []).map((row) => [row.id, row])
  );
  const profileById = new Map(
    ((profileResult.data || []) as HistoryProfile[]).map((row) => [row.id, row])
  );
  const missingCustomerIds = Array.from(
    new Set(
      (requestResult.data || [])
        .map((row) => row.customer_id)
        .filter((id) => id && !profileById.has(id))
    )
  );
  if (missingCustomerIds.length) {
    const { data: customerProfiles, error: customerProfileError } = await admin
      .from("profiles")
      .select("id, first_name, display_name")
      .in("id", missingCustomerIds);
    if (customerProfileError) {
      return { rows: [], error: "Could not load Hub history." };
    }
    for (const profile of (customerProfiles || []) as HistoryProfile[]) {
      profileById.set(profile.id, profile);
    }
  }
  const shiftById = new Map(
    (shiftResult.data || []).map((row) => [row.id, row.display_name])
  );
  const deviceById = new Map(
    (deviceResult.data || []).map((row) => [row.id, row.device_name])
  );

  const purchaseHistory: HubHistoryItem[] = purchaseRows.map((row) => {
    const request = row.request_id ? requestById.get(row.request_id) : undefined;
    const customerId = row.customer_id || request?.customer_id;
    const employeeDisplayName =
      (row.shift_employee_id
        ? shiftById.get(row.shift_employee_id)
        : null) ||
      (row.employee_user_id
        ? historyDisplayName(profileById.get(row.employee_user_id))
        : null) ||
      (row.hub_device_id ? deviceById.get(row.hub_device_id) : null) ||
      null;
    return {
      kind: "purchase",
      productName: request?.product_name || null,
      customerFirstName: safeCustomerName(
        customerId ? profileById.get(customerId) || {} : {}
      ),
      points: row.points_awarded,
      responseType: null,
      timestamp: row.confirmed_at,
      employeeDisplayName,
      source: row.source,
      status: row.status,
    };
  });

  const responseHistory: HubHistoryItem[] = responseRows.flatMap((row) => {
    const request = requestById.get(row.request_id);
    if (!request) return [];
    return [{
      kind: "request_answer" as const,
      productName: request.product_name,
      customerFirstName: safeCustomerName(
        profileById.get(request.customer_id) || {}
      ),
      points: null,
      responseType: row.response_type,
      timestamp: row.created_at,
      employeeDisplayName: historyDisplayName(
        profileById.get(row.responded_by)
      ),
    }];
  });

  return {
    rows: [...purchaseHistory, ...responseHistory]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 60),
  };
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
    .is("removed_at", null)
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
      pointsPerDollar: 1,
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
    pointsPerDollar: data?.points_per_dollar ?? 1,
    pointsPerPurchase: data?.points_per_purchase ?? 10,
    rewardThresholdPoints: data?.reward_threshold_points ?? 100,
    rewardValueCents: data?.reward_value_cents ?? 500,
  };
}

export async function updateStoreRewardSettingsAction(input: {
  enabled: boolean;
  pointsPerDollar: number;
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
    input.pointsPerDollar,
    input.pointsPerPurchase,
    input.rewardThresholdPoints,
    input.rewardValueCents,
  ];
  if (!values.every(Number.isInteger)) {
    return { ok: false as const, error: "Use whole numbers for reward settings." };
  }
  if (
    input.pointsPerDollar < 1 ||
    input.pointsPerDollar > 1000 ||
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
      points_per_dollar: input.pointsPerDollar,
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
      pointsPerDollar: input.pointsPerDollar,
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
    .is("removed_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(50);
  return data || [];
}
