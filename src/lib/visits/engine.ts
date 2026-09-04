"use server";

import {
  boundUuid,
  formatCents,
  monthLabelUtc,
  quoteUsageBill,
  utcMonthPeriod,
  type UsagePricingConfig,
} from "@findit/domain";
import { isDemoMode } from "@/lib/config/env";
import { isSoloAdmin } from "@/lib/auth/admin";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { generateSecret } from "@/lib/hub/crypto";
import { HUB_DEVICE_ONLINE_MS } from "@/lib/hub/constants";
import { deviceIsOnline } from "@/lib/hub/format";
import { resolveHubTerminalAction } from "@/lib/services/hub-devices";
import { getCurrentProfile, getStoreWorkspaceAction } from "@/lib/services/actions";
import { trackEvent } from "@/lib/services/analytics";
import { loadUsagePricing } from "@/lib/billing/usage-config";
import { getPaymentProvider } from "@/lib/billing/provider";
import { getHubClockStateAction } from "@/lib/services/shifts";
import { CHECKIN_TOKEN_TTL_MS, hashCheckinSecret } from "@/lib/visits/crypto";
import { visitsMemory } from "@/lib/visits/memory";
import type { VerifiedVisit } from "@/types/database";

function isTrialStore(trialEndsAt: string | null | undefined, now = new Date()): boolean {
  if (!trialEndsAt) return true;
  return new Date(trialEndsAt).getTime() > now.getTime();
}

async function adminClient() {
  const { createServiceClient } = await import("@/lib/supabase/admin");
  return createServiceClient();
}

export async function issueHubCheckinTokenAction(): Promise<
  { error: string } | { token: string; expiresAt: string; rotateMs: number }
> {
  const linked = await resolveHubTerminalAction();
  if (!linked.ok) return { error: "This tablet is not connected to a store." };
  if (linked.runtime.source !== "device" || !linked.runtime.deviceId) {
    return { error: "Check-in QR is for a paired FINDIT Hub tablet." };
  }
  const store = linked.runtime.store;
  if (!store.is_active || store.is_suspended) {
    return { error: "This store cannot accept check-ins right now." };
  }
  const secret = generateSecret(32);
  const tokenHash = hashCheckinSecret(secret);
  const expiresAt = new Date(Date.now() + CHECKIN_TOKEN_TTL_MS).toISOString();

  if (isDemoMode()) {
    visitsMemory().tokens.push({
      id: secret.slice(0, 36),
      storeId: store.id,
      deviceId: linked.runtime.deviceId,
      tokenHash,
      secret,
      expiresAt,
      usedAt: null,
    });
    return { token: secret, expiresAt, rotateMs: 45_000 };
  }

  const admin = await adminClient();
  const { error } = await admin.from("store_checkin_tokens").insert({
    store_id: store.id,
    device_id: linked.runtime.deviceId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) return { error: "Couldn't start check-in. Try again." };
  return { token: secret, expiresAt, rotateMs: 45_000 };
}

export async function selectStoreForRequestAction(input: {
  requestId: string;
  storeId: string;
}): Promise<{ error: string } | { ok: true; selectionId: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in" };
  const requestId = boundUuid(input.requestId);
  const storeId = boundUuid(input.storeId);
  if (!requestId || !storeId) return { error: "That store could not be selected." };

  if (isDemoMode()) {
    const existing = visitsMemory().selections.find(
      (row) =>
        row.shopperId === profile.id &&
        row.requestId === requestId &&
        row.storeId === storeId
    );
    if (existing) {
      void trackEvent("store_selected", {
        userId: profile.id,
        storeId,
        requestId,
      });
      return { ok: true, selectionId: existing.id };
    }
    const id = crypto.randomUUID();
    visitsMemory().selections.push({
      id,
      shopperId: profile.id,
      storeId,
      requestId,
      createdAt: new Date().toISOString(),
    });
    void trackEvent("store_selected", { userId: profile.id, storeId, requestId });
    return { ok: true, selectionId: id };
  }

  const admin = await adminClient();
  const { data: request } = await admin
    .from("customer_requests")
    .select("id, customer_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.customer_id !== profile.id) {
    return { error: "That Find is not yours." };
  }
  const { data: response } = await admin
    .from("store_responses")
    .select("id")
    .eq("request_id", requestId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!response) return { error: "Pick a store that answered this Find." };

  const { data: existing } = await admin
    .from("store_selections")
    .select("id")
    .eq("shopper_id", profile.id)
    .eq("request_id", requestId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (existing) {
    void trackEvent("store_selected", { userId: profile.id, storeId, requestId });
    return { ok: true, selectionId: existing.id };
  }
  const { data: inserted, error } = await admin
    .from("store_selections")
    .insert({
      shopper_id: profile.id,
      store_id: storeId,
      request_id: requestId,
      store_response_id: response.id,
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted) return { error: "Couldn't save that store." };
  void trackEvent("store_selected", { userId: profile.id, storeId, requestId });
  return { ok: true, selectionId: inserted.id };
}

export async function verifyHubCheckinAction(token: string): Promise<
  | { error: string }
  | {
      ok: true;
      storeName: string;
      points: number;
      flagged: boolean;
    }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in to check in." };
  if (profile.account_type !== "customer") {
    return { error: "Check-in is for FINDIT shoppers." };
  }
  const limited = await consumeRateLimit({
    bucket: "hub-checkin",
    limit: 12,
    windowMs: 10 * 60 * 1000,
    key: profile.id,
  });
  if (!limited.ok) return { error: limited.error };

  const secret = (token || "").trim();
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    void trackEvent("checkin_attempted", {
      userId: profile.id,
      metadata: { result: "invalid_token" },
    });
    return { error: "That check-in code is not valid." };
  }
  const tokenHash = hashCheckinSecret(secret);
  const pricing = await loadUsagePricing();

  if (isDemoMode()) {
    return verifyDemoCheckin(profile.id, secret, tokenHash, pricing);
  }

  const admin = await adminClient();
  await admin.from("checkin_attempts").insert({
    shopper_id: profile.id,
    token_hash: tokenHash,
    result: "attempted",
  });

  const { data: tokenRow } = await admin
    .from("store_checkin_tokens")
    .select("id, store_id, device_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!tokenRow) {
    void trackEvent("checkin_attempted", {
      userId: profile.id,
      metadata: { result: "unknown_token" },
    });
    return { error: "That check-in code expired. Scan the live Hub screen." };
  }
  if (tokenRow.used_at) {
    void trackEvent("visit_rejected", {
      userId: profile.id,
      storeId: tokenRow.store_id,
      metadata: { reason: "reused_token" },
    });
    return { error: "That check-in code was already used." };
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    void trackEvent("visit_rejected", {
      userId: profile.id,
      storeId: tokenRow.store_id,
      metadata: { reason: "expired_token" },
    });
    return { error: "That check-in code expired. Scan the live Hub screen." };
  }

  const { data: store } = await admin
    .from("stores")
    .select("id, name, is_active, is_suspended, trial_ends_at")
    .eq("id", tokenRow.store_id)
    .maybeSingle();
  if (!store || !store.is_active || store.is_suspended) {
    return { error: "This store is not accepting check-ins." };
  }

  const { data: device } = await admin
    .from("store_devices")
    .select("id, revoked_at, last_seen_at")
    .eq("id", tokenRow.device_id)
    .maybeSingle();
  if (!device || device.revoked_at) {
    return { error: "This Hub is no longer connected." };
  }
  if (!deviceIsOnline(device.last_seen_at, Date.now(), HUB_DEVICE_ONLINE_MS)) {
    return { error: "This Hub looks offline. Ask the store to refresh FINDIT Hub." };
  }

  const { data: membership } = await admin
    .from("store_members")
    .select("id")
    .eq("store_id", store.id)
    .eq("user_id", profile.id)
    .eq("status", "active")
    .maybeSingle();
  if (membership) {
    return { error: "Employees cannot check in as a FINDIT customer at their store." };
  }

  const { data: duplicate } = await admin
    .from("verified_visits")
    .select("id")
    .eq("shopper_id", profile.id)
    .eq("store_id", store.id)
    .in("status", ["pending", "verified", "fraud_review"])
    .gte("verified_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .limit(8);

  const { data: selection } = await admin
    .from("store_selections")
    .select("id, request_id, store_response_id")
    .eq("shopper_id", profile.id)
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let requestId = selection?.request_id as string | undefined;
  let responseId = selection?.store_response_id as string | null | undefined;
  const selectionId = selection?.id as string | undefined;

  if (!requestId) {
    const { data: ownRequests } = await admin
      .from("customer_requests")
      .select("id")
      .eq("customer_id", profile.id)
      .in("status", ["active", "partially_answered", "answered", "fulfilled"]);
    const ids = (ownRequests || []).map((row) => row.id);
    if (ids.length) {
      const { data: response } = await admin
        .from("store_responses")
        .select("id, request_id")
        .eq("store_id", store.id)
        .in("request_id", ids)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (response) {
        requestId = response.request_id;
        responseId = response.id;
      }
    }
  }

  if (!requestId) {
    void trackEvent("visit_rejected", {
      userId: profile.id,
      storeId: store.id,
      metadata: { reason: "no_selection" },
    });
    return { error: "Choose this store on your Find first, then scan when you arrive." };
  }

  const { data: already } = await admin
    .from("verified_visits")
    .select("id")
    .eq("shopper_id", profile.id)
    .eq("request_id", requestId)
    .eq("store_id", store.id)
    .in("status", ["pending", "verified", "fraud_review"])
    .maybeSingle();
  if (already) {
    return { error: "This visit is already counted." };
  }

  const { data: responder } = responseId
    ? await admin
        .from("store_responses")
        .select("responded_by")
        .eq("id", responseId)
        .maybeSingle()
    : { data: null };

  const { data: openPunch } = await admin
    .from("store_shift_punches")
    .select("employee_id")
    .eq("store_id", store.id)
    .eq("device_id", tokenRow.device_id)
    .is("clocked_out_at", null)
    .maybeSingle();

  const recentCount = (duplicate || []).length;
  const flagged = recentCount >= 5;
  const trial = isTrialStore(store.trial_ends_at);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count: todayRewards } = await admin
    .from("reward_ledger")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("audience", "shopper")
    .eq("reward_type", "verified_visit")
    .gte("created_at", dayStart.toISOString());
  const rewardableShopper =
    !flagged && (todayRewards || 0) < pricing.shopperMaxRewardedCheckinsPerDay;

  const { data: visit, error: visitError } = await admin
    .from("verified_visits")
    .insert({
      shopper_id: profile.id,
      store_id: store.id,
      request_id: requestId,
      store_selection_id: selectionId || null,
      store_response_id: responseId || null,
      employee_user_id: openPunch ? null : responder?.responded_by || null,
      shift_employee_id: openPunch?.employee_id || null,
      hub_device_id: tokenRow.device_id,
      checkin_token_id: tokenRow.id,
      verification_method: "hub_qr",
      status: flagged ? "fraud_review" : "verified",
      billable: !trial && !flagged,
      rewardable: rewardableShopper,
      fraud_status: flagged ? "flagged" : "clean",
      reject_reason: flagged ? "Rapid repeat check-ins" : null,
    })
    .select("*")
    .maybeSingle();
  if (visitError || !visit) {
    if (visitError?.code === "23505") return { error: "This visit is already counted." };
    return { error: "Couldn't record this visit. Try again." };
  }

  await admin
    .from("store_checkin_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  await recordVisitBilling(store.id, visit as VerifiedVisit, trial, pricing);
  const points = await recordVisitRewards({
    visit: visit as VerifiedVisit,
    shopperId: profile.id,
    responderId: responder?.responded_by || null,
    rewardableShopper,
    flagged,
    pricing,
  });

  void trackEvent(flagged ? "visit_rejected" : "visit_verified", {
    userId: profile.id,
    storeId: store.id,
    requestId,
    metadata: { visitId: visit.id, flagged },
  });

  return {
    ok: true,
    storeName: store.name,
    points,
    flagged,
  };
}

async function verifyDemoCheckin(
  shopperId: string,
  secret: string,
  tokenHash: string,
  pricing: UsagePricingConfig
): Promise<{ error: string } | { ok: true; storeName: string; points: number; flagged: boolean }> {
  const mem = visitsMemory();
  const tokenRow = mem.tokens.find((row) => row.tokenHash === tokenHash && !row.usedAt);
  if (!tokenRow || new Date(tokenRow.expiresAt).getTime() < Date.now()) {
    return { error: "That check-in code expired. Scan the live Hub screen." };
  }
  const selection = mem.selections.find(
    (row) => row.shopperId === shopperId && row.storeId === tokenRow.storeId
  );
  if (!selection) {
    return { error: "Choose this store on your Find first, then scan when you arrive." };
  }
  if (
    mem.visits.some(
      (row) =>
        row.shopper_id === shopperId &&
        row.request_id === selection.requestId &&
        row.store_id === tokenRow.storeId
    )
  ) {
    return { error: "This visit is already counted." };
  }
  tokenRow.usedAt = new Date().toISOString();
  const visit: VerifiedVisit = {
    id: crypto.randomUUID(),
    shopper_id: shopperId,
    store_id: tokenRow.storeId,
    request_id: selection.requestId,
    store_selection_id: selection.id,
    store_response_id: null,
    employee_user_id: null,
    shift_employee_id: null,
    hub_device_id: tokenRow.deviceId,
    checkin_token_id: tokenRow.id,
    verification_method: "hub_qr",
    verified_at: new Date().toISOString(),
    status: "verified",
    billable: false,
    rewardable: true,
    fraud_status: "clean",
    reject_reason: null,
    created_at: new Date().toISOString(),
  };
  mem.visits.push(visit);
  mem.rewards.push({
    userId: shopperId,
    points: pricing.shopperPointsPerVisit,
    audience: "shopper",
  });
  return {
    ok: true,
    storeName: "Demo store",
    points: pricing.shopperPointsPerVisit,
    flagged: false,
  };
}

async function ensurePeriod(storeId: string) {
  const { start, end } = utcMonthPeriod();
  const admin = await adminClient();
  const { data: existing } = await admin
    .from("store_billing_periods")
    .select("id")
    .eq("store_id", storeId)
    .eq("period_start", start.toISOString())
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data: inserted, error } = await admin
    .from("store_billing_periods")
    .insert({
      store_id: storeId,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted) {
    const { data: again } = await admin
      .from("store_billing_periods")
      .select("id")
      .eq("store_id", storeId)
      .eq("period_start", start.toISOString())
      .maybeSingle();
    return again?.id as string;
  }
  return inserted.id as string;
}

async function recordVisitBilling(
  storeId: string,
  visit: VerifiedVisit,
  trial: boolean,
  pricing: UsagePricingConfig
) {
  const periodId = await ensurePeriod(storeId);
  if (!periodId) return;
  const admin = await adminClient();
  const { start } = utcMonthPeriod();
  const { count } = await admin
    .from("verified_visits")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("status", "verified")
    .gte("verified_at", start.toISOString());
  const quote = quoteUsageBill(count || 0, pricing);
  const { data: statement } = await admin
    .from("store_usage_statements")
    .select("id")
    .eq("billing_period_id", periodId)
    .maybeSingle();
  let statementId = statement?.id as string | undefined;
  if (!statementId) {
    const { data: created } = await admin
      .from("store_usage_statements")
      .insert({
        store_id: storeId,
        billing_period_id: periodId,
        status: "draft",
        visit_count: count || 0,
        estimated_cents: quote.estimatedCents,
        trial,
        charged_cents: 0,
        tier_id: quote.tier.id,
        payment_provider: getPaymentProvider().id,
      })
      .select("id")
      .maybeSingle();
    statementId = created?.id;
    void trackEvent("invoice_created", { storeId, metadata: { statementId } });
  } else {
    await admin
      .from("store_usage_statements")
      .update({
        visit_count: count || 0,
        estimated_cents: quote.estimatedCents,
        trial,
        charged_cents: 0,
        tier_id: quote.tier.id,
      })
      .eq("id", statementId);
  }
  await admin.from("store_billing_ledger").insert({
    store_id: storeId,
    verified_visit_id: visit.id,
    billing_period_id: periodId,
    statement_id: statementId || null,
    event_type: "verified_visit_usage",
    amount_cents: visit.billable && quote.tier.kind === "payg" ? pricing.visitCents : 0,
    description: trial
      ? "Verified visit during trial (not charged)"
      : "Verified FINDIT customer visit",
    status: "recorded",
  });
  const { data: baseRow } = await admin
    .from("store_billing_ledger")
    .select("id")
    .eq("billing_period_id", periodId)
    .eq("event_type", "base_subscription")
    .maybeSingle();
  if (!baseRow) {
    await admin.from("store_billing_ledger").insert({
      store_id: storeId,
      billing_period_id: periodId,
      statement_id: statementId || null,
      event_type: "base_subscription",
      amount_cents:
        trial || quote.tier.kind !== "payg" ? 0 : pricing.baseMonthlyCents,
      description: trial
        ? "Monthly base during trial (not charged)"
        : quote.tier.kind === "payg"
          ? "Monthly base"
          : `${quote.tier.name} plan (see statement total)`,
      status: "recorded",
    });
  }
  void trackEvent("billing_event_created", {
    storeId,
    metadata: { visitId: visit.id, trial },
  });
}

async function recordVisitRewards(input: {
  visit: VerifiedVisit;
  shopperId: string;
  responderId: string | null;
  rewardableShopper: boolean;
  flagged: boolean;
  pricing: UsagePricingConfig;
}): Promise<number> {
  if (input.flagged) return 0;
  const admin = await adminClient();
  let shopperPoints = 0;
  if (input.rewardableShopper) {
    shopperPoints = input.pricing.shopperPointsPerVisit;
    await admin.from("reward_ledger").insert({
      user_id: input.shopperId,
      store_id: input.visit.store_id,
      verified_visit_id: input.visit.id,
      reward_type: "verified_visit",
      audience: "shopper",
      points: shopperPoints,
      status: "confirmed",
      reason: "Verified FINDIT visit",
    });
    void trackEvent("reward_created", {
      userId: input.shopperId,
      storeId: input.visit.store_id,
      metadata: { audience: "shopper", points: shopperPoints },
    });
  }
  if (input.visit.employee_user_id && input.visit.employee_user_id !== input.shopperId) {
    await admin.from("reward_ledger").insert({
      user_id: input.visit.employee_user_id,
      store_id: input.visit.store_id,
      verified_visit_id: input.visit.id,
      reward_type: "verified_visit",
      audience: "employee",
      points: input.pricing.employeePointsPerVisit,
      status: "confirmed",
      reason: "Customer arrived after your reply",
    });
    void trackEvent("reward_created", {
      userId: input.visit.employee_user_id,
      storeId: input.visit.store_id,
      metadata: { audience: "employee" },
    });
  }
  return shopperPoints;
}

function employeePoolCents(billedCents: number, pricing: UsagePricingConfig) {
  if (!pricing.employeePoolEnabled) return 0;
  const raw = Math.round((billedCents * pricing.employeePoolPercent) / 100);
  if (pricing.employeePoolMaxCents == null) return raw;
  return Math.min(raw, pricing.employeePoolMaxCents);
}

export type StoreUsageSnapshot = Awaited<ReturnType<typeof loadStoreUsageSnapshot>>;

export async function getStoreUsageSnapshotAction() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const workspace = await getStoreWorkspaceAction();
  const store = workspace?.store;
  if (!store) return null;
  if (!workspace?.canManageStore && !isSoloAdmin(profile)) return null;
  return loadStoreUsageSnapshot(store.id, store.trial_ends_at, store.name);
}

export async function loadStoreUsageSnapshot(
  storeId: string,
  trialEndsAt: string | null,
  storeName?: string
) {
  const pricing = await loadUsagePricing();
  const { start, end } = utcMonthPeriod();
  const trial = isTrialStore(trialEndsAt);

  if (isDemoMode()) {
    const visits = visitsMemory().visits.filter((row) => row.store_id === storeId);
    const quote = quoteUsageBill(visits.length, pricing);
    const billedCents = trial ? 0 : quote.estimatedCents;
    return {
      storeName: storeName || "Store",
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      monthLabel: monthLabelUtc(),
      trial,
      trialEndsAt,
      visits: visits.length,
      quote,
      billedCents,
      funnel: {
        matched: 0,
        responses: 0,
        selected: visitsMemory().selections.filter((row) => row.storeId === storeId).length,
        verified: visits.length,
      },
      ledger: [] as { id: string; description: string; amount_cents: number; created_at: string }[],
      disputes: [] as { id: string; reason: string; status: string; created_at: string }[],
      visitsSafe: visits.map((row) => ({
        id: row.id,
        verified_at: row.verified_at,
        status: row.status,
        billable: row.billable,
      })),
      statements: [] as {
        id: string;
        status: string;
        visit_count: number;
        estimated_cents: number;
        charged_cents: number;
        trial: boolean;
        created_at: string;
      }[],
      fraudCount: 0,
      rewardPointsIssued: 0,
      poolCents: employeePoolCents(billedCents, pricing),
      poolEnabled: pricing.employeePoolEnabled,
      poolPercent: pricing.employeePoolPercent,
      formatEstimated: formatCents(quote.estimatedCents),
      formatBilled: formatCents(billedCents),
      formatEffective: quote.effectiveCentsPerVisit
        ? formatCents(quote.effectiveCentsPerVisit)
        : "—",
    };
  }

  const admin = await adminClient();
  const [
    { count: matched },
    { count: responses },
    { count: selected },
    { count: visitCount },
    { count: fraudCount },
    { data: visitRows },
    { data: ledgerRows },
    { data: disputeRows },
    { data: statementRows },
    { data: rewardRows },
  ] = await Promise.all([
    admin
      .from("request_targets")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", start.toISOString()),
    admin
      .from("store_responses")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", start.toISOString()),
    admin
      .from("store_selections")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", start.toISOString()),
    admin
      .from("verified_visits")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "verified")
      .gte("verified_at", start.toISOString()),
    admin
      .from("verified_visits")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .neq("fraud_status", "clean")
      .gte("verified_at", start.toISOString()),
    admin
      .from("verified_visits")
      .select("id, verified_at, status, billable, fraud_status")
      .eq("store_id", storeId)
      .gte("verified_at", start.toISOString())
      .order("verified_at", { ascending: false })
      .limit(40),
    admin
      .from("store_billing_ledger")
      .select("id, description, amount_cents, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("billing_disputes")
      .select("id, reason, status, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("store_usage_statements")
      .select("id, status, visit_count, estimated_cents, charged_cents, trial, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("reward_ledger")
      .select("points")
      .eq("store_id", storeId)
      .eq("status", "confirmed")
      .gte("created_at", start.toISOString()),
  ]);

  const visits = visitCount || 0;
  const quote = quoteUsageBill(visits, pricing);
  const billedCents = trial ? 0 : quote.estimatedCents;
  return {
    storeName: storeName || "Store",
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    monthLabel: monthLabelUtc(),
    trial,
    trialEndsAt,
    visits,
    quote,
    billedCents,
    funnel: {
      matched: matched || 0,
      responses: responses || 0,
      selected: selected || 0,
      verified: visits,
    },
    ledger: ledgerRows || [],
    disputes: disputeRows || [],
    visitsSafe: visitRows || [],
    statements: statementRows || [],
    fraudCount: fraudCount || 0,
    rewardPointsIssued: (rewardRows || []).reduce(
      (sum, row) => sum + Number(row.points || 0),
      0
    ),
    poolCents: employeePoolCents(billedCents, pricing),
    poolEnabled: pricing.employeePoolEnabled,
    poolPercent: pricing.employeePoolPercent,
    formatEstimated: formatCents(quote.estimatedCents),
    formatBilled: formatCents(billedCents),
    formatEffective: quote.effectiveCentsPerVisit
      ? formatCents(quote.effectiveCentsPerVisit)
      : "—",
  };
}

export async function disputeVerifiedVisitAction(input: {
  visitId: string;
  reason: string;
}): Promise<{ error: string } | { ok: true }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in" };
  const workspace = await getStoreWorkspaceAction();
  if (!workspace?.canManageStore || !workspace.store) {
    return { error: "Only owners and managers can report a visit." };
  }
  const visitId = boundUuid(input.visitId);
  const reason = input.reason.trim().slice(0, 500);
  if (!visitId || reason.length < 8) {
    return { error: "Tell us what is wrong with this visit." };
  }
  if (isDemoMode()) return { ok: true };
  const admin = await adminClient();
  const { data: visit } = await admin
    .from("verified_visits")
    .select("id, store_id")
    .eq("id", visitId)
    .eq("store_id", workspace.store.id)
    .maybeSingle();
  if (!visit) return { error: "That visit is not on this store." };
  const { error } = await admin.from("billing_disputes").insert({
    store_id: workspace.store.id,
    verified_visit_id: visitId,
    opened_by: profile.id,
    reason,
  });
  if (error) return { error: "Couldn't save that report." };
  void trackEvent("billing_dispute_created", {
    userId: profile.id,
    storeId: workspace.store.id,
    metadata: { visitId },
  });
  return { ok: true };
}

export async function getShopperPointsAction() {
  const profile = await getCurrentProfile();
  if (!profile) return { points: 0, visits: 0 };
  if (isDemoMode()) {
    const points = visitsMemory()
      .rewards.filter((row) => row.userId === profile.id && row.audience === "shopper")
      .reduce((sum, row) => sum + row.points, 0);
    return { points, visits: visitsMemory().visits.filter((row) => row.shopper_id === profile.id).length };
  }
  const admin = await adminClient();
  const { data } = await admin
    .from("reward_ledger")
    .select("points")
    .eq("user_id", profile.id)
    .eq("audience", "shopper")
    .eq("status", "confirmed");
  const points = (data || []).reduce((sum, row) => sum + Number(row.points || 0), 0);
  const { count } = await admin
    .from("verified_visits")
    .select("*", { count: "exact", head: true })
    .eq("shopper_id", profile.id)
    .eq("status", "verified");
  return { points, visits: count || 0 };
}

export async function getEmployeeRewardsAction() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const workspace = await getStoreWorkspaceAction();
  const storeId = workspace?.store?.id;
  if (!storeId) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const week = new Date(start);
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
  if (isDemoMode()) {
    return {
      answeredToday: 0,
      arrivedToday: 0,
      helpedWeek: 0,
      points: 0,
    };
  }
  const admin = await adminClient();
  const [{ count: answeredToday }, { count: arrivedToday }, { count: helpedWeek }, { data: rewards }] =
    await Promise.all([
      admin
        .from("store_responses")
        .select("*", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("responded_by", profile.id)
        .gte("created_at", start.toISOString()),
      admin
        .from("verified_visits")
        .select("*", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("employee_user_id", profile.id)
        .gte("verified_at", start.toISOString()),
      admin
        .from("verified_visits")
        .select("*", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("employee_user_id", profile.id)
        .gte("verified_at", week.toISOString()),
      admin
        .from("reward_ledger")
        .select("points")
        .eq("user_id", profile.id)
        .eq("audience", "employee")
        .eq("status", "confirmed"),
    ]);
  return {
    answeredToday: answeredToday || 0,
    arrivedToday: arrivedToday || 0,
    helpedWeek: helpedWeek || 0,
    points: (rewards || []).reduce((sum, row) => sum + Number(row.points || 0), 0),
  };
}

export async function getHubEmployeeRewardsAction() {
  const fromAccount = await getEmployeeRewardsAction();
  if (fromAccount) return fromAccount;
  const linked = await resolveHubTerminalAction();
  if (!linked.ok) return null;
  const clock = await getHubClockStateAction();
  if (!clock.required || !clock.clockedIn) return null;
  const storeId = linked.runtime.store.id;
  const employeeId = clock.clockedIn.employeeId;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const week = new Date(start);
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
  const pricing = await loadUsagePricing();
  if (isDemoMode()) {
    return { answeredToday: 0, arrivedToday: 0, helpedWeek: 0, points: 0 };
  }
  const admin = await adminClient();
  const [{ count: answeredToday }, { count: arrivedToday }, { count: helpedWeek }] =
    await Promise.all([
      admin
        .from("store_responses")
        .select("*", { count: "exact", head: true })
        .eq("store_id", storeId)
        .gte("created_at", clock.clockedIn.since),
      admin
        .from("verified_visits")
        .select("*", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("shift_employee_id", employeeId)
        .eq("status", "verified")
        .gte("verified_at", start.toISOString()),
      admin
        .from("verified_visits")
        .select("*", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("shift_employee_id", employeeId)
        .eq("status", "verified")
        .gte("verified_at", week.toISOString()),
    ]);
  return {
    answeredToday: answeredToday || 0,
    arrivedToday: arrivedToday || 0,
    helpedWeek: helpedWeek || 0,
    points: (arrivedToday || 0) * pricing.employeePointsPerVisit,
  };
}

export async function getAdminBillingConfigAction() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return null;
  return loadUsagePricing();
}

export async function saveAdminBillingConfigAction(
  patch: Partial<UsagePricingConfig>
): Promise<{ error: string } | { ok: true }> {
  const profile = await getCurrentProfile();
  if (!profile || !isSoloAdmin(profile)) return { error: "Unauthorized" };
  if (isDemoMode()) return { ok: true };
  const current = await loadUsagePricing();
  const next = { ...current, ...patch };
  const admin = await adminClient();
  const { error } = await admin.from("findit_billing_config").upsert({
    id: 1,
    base_monthly_cents: next.baseMonthlyCents,
    visit_cents: next.visitCents,
    payg_max_visits: next.paygMaxVisits,
    payg_max_cents: next.paygMaxCents,
    growth_min_visits: next.growthMinVisits,
    growth_max_visits: next.growthMaxVisits,
    growth_monthly_cents: next.growthMonthlyCents,
    business_min_visits: next.businessMinVisits,
    business_max_visits: next.businessMaxVisits,
    business_monthly_cents: next.businessMonthlyCents,
    high_volume_min_visits: next.highVolumeMinVisits,
    high_volume_max_visits: next.highVolumeMaxVisits,
    high_volume_monthly_cents: next.highVolumeMonthlyCents,
    enterprise_min_visits: next.enterpriseMinVisits,
    trial_days: next.trialDays,
    employee_pool_percent: next.employeePoolPercent,
    employee_pool_max_cents: next.employeePoolMaxCents,
    employee_pool_enabled: next.employeePoolEnabled,
    shopper_points_per_visit: next.shopperPointsPerVisit,
    employee_points_per_visit: next.employeePointsPerVisit,
    shopper_max_rewarded_checkins_per_day: next.shopperMaxRewardedCheckinsPerDay,
    updated_by: profile.id,
  });
  if (error) return { error: "Couldn't save pricing." };
  return { ok: true };
}
