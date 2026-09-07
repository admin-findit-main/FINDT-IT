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
import { resolveHubTerminalAction } from "@/lib/services/hub-devices";
import { getCurrentProfile, getStoreWorkspaceAction } from "@/lib/services/actions";
import { trackEvent } from "@/lib/services/analytics";
import { loadUsagePricing } from "@/lib/billing/usage-config";
import { getHubClockStateAction } from "@/lib/services/shifts";
import { visitsMemory } from "@/lib/visits/memory";

function isTrialStore(trialEndsAt: string | null | undefined, now = new Date()): boolean {
  if (!trialEndsAt) return true;
  return new Date(trialEndsAt).getTime() > now.getTime();
}

async function adminClient() {
  const { createServiceClient } = await import("@/lib/supabase/admin");
  return createServiceClient();
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

/**
 * Admin-only read of another store's statement.
 *
 * The store id, name and trial date are re-read from the database rather than
 * taken from the caller, so the billing period and trial pricing can't be
 * spoofed by whoever invokes this.
 */
export async function getAdminStoreUsageSnapshotAction(storeId: string) {
  const profile = await getCurrentProfile();
  if (!profile || !isSoloAdmin(profile)) return null;

  const admin = await adminClient();
  const { data: store } = await admin
    .from("stores")
    .select("id, name, trial_ends_at")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) return null;

  return loadStoreUsageSnapshot(store.id, store.trial_ends_at, store.name);
}

/**
 * Deliberately NOT exported: every export from a `"use server"` module is a
 * callable endpoint, and this one trusts a caller-supplied store id and trial
 * date. Exporting it let any signed-in browser read — and re-price — another
 * store's ledger, visits and disputes. Reach it through
 * `getStoreUsageSnapshotAction` or `getAdminStoreUsageSnapshotAction`.
 */
async function loadStoreUsageSnapshot(
  storeId: string,
  trialEndsAt: string | null,
  storeName?: string
) {
  // Started, not awaited: pricing isn't needed until the tallies come back, so
  // it rides alongside the query batch below instead of adding a round trip.
  const pricingPromise = loadUsagePricing();
  const { start, end } = utcMonthPeriod();
  const trial = isTrialStore(trialEndsAt);

  if (isDemoMode()) {
    const pricing = await pricingPromise;
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
    pricing,
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
    pricingPromise,
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
      // FINDIT-funded points only. Store loyalty points sit in the same table
      // but are funded by the store, so counting them here would report them
      // as a FINDIT reward cost on the store's usage statement.
      .eq("program", "findit")
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
    // This is the FINDIT Points balance shown on the shopper's Rewards screen.
    // Store loyalty points are a per-store currency and are read from
    // store_customers.points_balance instead; adding them here would present
    // one meaningless total spendable at neither.
    .eq("program", "findit")
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
        // The employee incentive is a FINDIT program; store loyalty points
        // belong to shoppers and must not appear in an employee's total.
        .eq("program", "findit")
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
