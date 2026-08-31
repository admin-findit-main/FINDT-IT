"use server";

import {
  BILLING_LAUNCH_CHECKS,
  BILLING_PLANS,
  STORE_BILLING_STATUS_LABELS,
  formatMoney,
  launchChecklistComplete,
  storeOperatingAccess,
  type BillingLaunchCheckId,
} from "@findit/domain";
import { isSoloAdmin } from "@/lib/auth/admin";
import {
  accessRulesFromSettings,
  getBillingSettings,
  liveChargesAllowed,
} from "@/lib/billing/settings";
import {
  cancelFastSpringSubscription,
  createFastSpringAccountManagementUrl,
  createFastSpringCheckout,
} from "@/lib/billing/fastspring";
import { isDemoMode, isFastSpringConfigured, isFastSpringLiveMode } from "@/lib/config/env";
import {
  getCurrentProfile,
  getStoreWorkspaceAction,
} from "@/lib/services/actions";
import type {
  BillingInvoice,
  BillingSettings,
  CustomerSubscription,
  Store,
  StoreSubscription,
} from "@/types/database";

function requireConfigured() {
  if (!isFastSpringConfigured()) {
    return {
      error:
        "FastSpring is not connected yet. Add the server API credentials to enable checkout.",
    };
  }
  return null;
}

async function requireStoreOwner() {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in" as const };
  const workspace = await getStoreWorkspaceAction();
  const store = workspace?.store;
  if (!store) return { error: "No store linked" as const };
  if (workspace?.role !== "owner" && !isSoloAdmin(profile)) {
    return { error: "Only the store owner can manage billing." as const };
  }
  return { profile, store };
}

async function requireShopper() {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in" as const };
  return { profile };
}

export async function getStoreBillingAction() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const workspace = await getStoreWorkspaceAction();
  const store = workspace?.store;
  if (!store) return null;
  const settings = await getBillingSettings();
  const rules = accessRulesFromSettings(settings);

  let subscription: StoreSubscription | null = null;
  let invoices: BillingInvoice[] = [];
  if (!isDemoMode()) {
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      const [{ data: sub }, { data: history }] = await Promise.all([
        admin.from("subscriptions").select("*").eq("store_id", store.id).maybeSingle(),
        admin
          .from("billing_invoices")
          .select("*")
          .eq("store_id", store.id)
          .order("occurred_at", { ascending: false })
          .limit(24),
      ]);
      subscription = (sub as StoreSubscription | null) ?? null;
      invoices = (history as BillingInvoice[]) || [];
    } catch {
      subscription = null;
    }
  }

  const status = (subscription?.status ||
    store.subscription_status ||
    "trial") as keyof typeof STORE_BILLING_STATUS_LABELS;
  const access = storeOperatingAccess(
    {
      status,
      paymentStatus: subscription?.payment_status,
      accessOverride: subscription?.access_override,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end,
      currentPeriodEnd: subscription?.current_period_end,
    },
    rules
  );

  return {
    store,
    subscription,
    invoices,
    settings,
    access,
    canManage: workspace?.role === "owner" || isSoloAdmin(profile),
    configured: isFastSpringConfigured(),
    liveCharges: liveChargesAllowed(settings),
    testMode: !liveChargesAllowed(settings),
    plan: BILLING_PLANS.business,
    priceLabel: `${formatMoney(BILLING_PLANS.business.priceMonthly)}/month`,
    statusLabel: STORE_BILLING_STATUS_LABELS[status] || status,
  };
}

export async function getCustomerBillingAction() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const settings = await getBillingSettings();
  let subscription: CustomerSubscription | null = null;
  let invoices: BillingInvoice[] = [];
  if (!isDemoMode()) {
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      const [{ data: sub }, { data: history }] = await Promise.all([
        admin
          .from("customer_subscriptions")
          .select("*")
          .eq("profile_id", profile.id)
          .maybeSingle(),
        admin
          .from("billing_invoices")
          .select("*")
          .eq("profile_id", profile.id)
          .order("occurred_at", { ascending: false })
          .limit(24),
      ]);
      subscription = (sub as CustomerSubscription | null) ?? null;
      invoices = (history as BillingInvoice[]) || [];
    } catch {
      subscription = null;
    }
  }
  return {
    profile,
    subscription,
    invoices,
    settings,
    configured: isFastSpringConfigured(),
    liveCharges: liveChargesAllowed(settings),
    testMode: !liveChargesAllowed(settings),
    shopperBillingRequired: settings.shopper_billing_required,
    plan: BILLING_PLANS.plus,
    priceLabel: `${formatMoney(BILLING_PLANS.plus.priceMonthly)}/month`,
  };
}

export async function startStoreCheckoutAction() {
  const gate = requireConfigured();
  if (gate) return gate;
  const auth = await requireStoreOwner();
  if ("error" in auth) return auth;
  if (!auth.profile.email) {
    return { error: "Add an email to your account before starting billing." };
  }
  const settings = await getBillingSettings();
  try {
    const checkout = await createFastSpringCheckout({
      audience: "store",
      email: auth.profile.email,
      firstName: auth.profile.first_name,
      lastName: auth.profile.last_name,
      company: auth.store.name,
      storeId: auth.store.id,
      profileId: auth.profile.id,
      liveApproved: liveChargesAllowed(settings),
    });
    return { url: checkout.checkoutUrl, testMode: checkout.testMode };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not start checkout",
    };
  }
}

export async function startCustomerCheckoutAction() {
  const gate = requireConfigured();
  if (gate) return gate;
  const auth = await requireShopper();
  if ("error" in auth) return auth;
  const settings = await getBillingSettings();
  if (liveChargesAllowed(settings) && settings.shopper_billing_required === false) {
    return { error: "FINDIT+ checkout is not open yet." };
  }
  if (!auth.profile.email) {
    return { error: "Add an email to your account before starting FINDIT+." };
  }
  try {
    const checkout = await createFastSpringCheckout({
      audience: "customer",
      email: auth.profile.email,
      firstName: auth.profile.first_name,
      lastName: auth.profile.last_name,
      profileId: auth.profile.id,
      liveApproved: liveChargesAllowed(settings) && settings.shopper_billing_required,
    });
    return { url: checkout.checkoutUrl, testMode: checkout.testMode };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not start checkout",
    };
  }
}

export async function manageStoreBillingAction() {
  const auth = await requireStoreOwner();
  if ("error" in auth) return auth;
  const billing = await getStoreBillingAction();
  const accountId = billing?.subscription?.provider_customer_id;
  if (!accountId) return { error: "No FastSpring account is linked yet." };
  try {
    const url = await createFastSpringAccountManagementUrl(accountId);
    return { url };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not open billing portal",
    };
  }
}

export async function manageCustomerBillingAction() {
  const auth = await requireShopper();
  if ("error" in auth) return auth;
  const billing = await getCustomerBillingAction();
  const accountId = billing?.subscription?.provider_customer_id;
  if (!accountId) return { error: "No FINDIT+ billing account is linked yet." };
  try {
    const url = await createFastSpringAccountManagementUrl(accountId);
    return { url };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not open billing portal",
    };
  }
}

export async function cancelStoreSubscriptionAction() {
  const auth = await requireStoreOwner();
  if ("error" in auth) return auth;
  const billing = await getStoreBillingAction();
  const subscriptionId = billing?.subscription?.provider_subscription_id;
  if (!subscriptionId) return { error: "No FastSpring subscription to cancel." };
  try {
    await cancelFastSpringSubscription(subscriptionId);
    return { ok: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not cancel subscription",
    };
  }
}

export async function cancelCustomerSubscriptionAction() {
  const auth = await requireShopper();
  if ("error" in auth) return auth;
  const billing = await getCustomerBillingAction();
  const subscriptionId = billing?.subscription?.provider_subscription_id;
  if (!subscriptionId) return { error: "No FINDIT+ subscription to cancel." };
  try {
    await cancelFastSpringSubscription(subscriptionId);
    return { ok: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not cancel subscription",
    };
  }
}

export async function getStoreBillingAccessAction(store?: Store | null) {
  const settings = await getBillingSettings();
  const snapshotStore = store || (await getStoreWorkspaceAction())?.store;
  if (!snapshotStore) {
    return {
      allowed: true,
      reason: "pilot" as const,
      billingRequired: settings.billing_required,
    };
  }
  let subscription: StoreSubscription | null = null;
  if (!isDemoMode()) {
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      const { data } = await admin
        .from("subscriptions")
        .select("*")
        .eq("store_id", snapshotStore.id)
        .maybeSingle();
      subscription = (data as StoreSubscription | null) ?? null;
    } catch {
      subscription = null;
    }
  }
  return {
    ...storeOperatingAccess(
      {
        status: subscription?.status || snapshotStore.subscription_status,
        paymentStatus: subscription?.payment_status,
        accessOverride: subscription?.access_override,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end,
        currentPeriodEnd: subscription?.current_period_end,
      },
      accessRulesFromSettings(settings)
    ),
    billingRequired: settings.billing_required,
  };
}

export type AdminBillingRow = {
  storeId: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string | null;
  legalName: string | null;
  plan: string;
  status: string;
  statusLabel: string;
  trialEndsAt: string | null;
  paymentStatus: string;
  billingMethod: string;
  lastPaymentAt: string | null;
  nextPaymentAt: string | null;
  accessOverride: string;
  fastspringAccountId: string | null;
  fastspringSubscriptionId: string | null;
};

export async function getAdminBillingAction(): Promise<{
  rows: AdminBillingRow[];
  settings: BillingSettings;
  liveEnv: boolean;
  checklistComplete: boolean;
  configured: boolean;
} | null> {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) return null;
  const settings = await getBillingSettings();
  if (isDemoMode()) {
    return {
      rows: [],
      settings,
      liveEnv: isFastSpringLiveMode(),
      checklistComplete: launchChecklistComplete(
        settings.launch_checklist as Partial<Record<BillingLaunchCheckId, boolean>>
      ),
      configured: isFastSpringConfigured(),
    };
  }
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: stores } = await admin
    .from("stores")
    .select("id, name, owner_id, legal_name, subscription_plan, subscription_status, trial_ends_at")
    .order("name");
  const storeIds = (stores || []).map((s) => s.id);
  const ownerIds = [...new Set((stores || []).map((s) => s.owner_id))];
  const [{ data: subs }, { data: owners }] = await Promise.all([
    storeIds.length
      ? admin.from("subscriptions").select("*").in("store_id", storeIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length
      ? admin
          .from("profiles")
          .select("id, email, first_name, last_name, display_name")
          .in("id", ownerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const subByStore = new Map(
    (subs || []).map((row) => [row.store_id as string, row as StoreSubscription])
  );
  const ownerById = new Map((owners || []).map((row) => [row.id as string, row]));
  const rows: AdminBillingRow[] = (stores || []).map((store) => {
    const sub = subByStore.get(store.id);
    const owner = ownerById.get(store.owner_id);
    const status = (sub?.status || store.subscription_status || "trial") as keyof typeof STORE_BILLING_STATUS_LABELS;
    return {
      storeId: store.id,
      storeName: store.name,
      ownerName:
        [owner?.first_name, owner?.last_name].filter(Boolean).join(" ") ||
        owner?.display_name ||
        "—",
      ownerEmail: owner?.email || null,
      legalName: store.legal_name,
      plan: sub?.plan_id || store.subscription_plan || "trial",
      status,
      statusLabel: STORE_BILLING_STATUS_LABELS[status] || status,
      trialEndsAt: sub?.trial_ends_at || store.trial_ends_at,
      paymentStatus: sub?.payment_status || "none",
      billingMethod: sub?.billing_method || "none",
      lastPaymentAt: sub?.last_payment_at || null,
      nextPaymentAt: sub?.next_payment_at || sub?.current_period_end || null,
      accessOverride: sub?.access_override || "none",
      fastspringAccountId: sub?.provider_customer_id || null,
      fastspringSubscriptionId: sub?.provider_subscription_id || null,
    };
  });
  return {
    rows,
    settings,
    liveEnv: isFastSpringLiveMode(),
    checklistComplete: launchChecklistComplete(
      settings.launch_checklist as Partial<Record<BillingLaunchCheckId, boolean>>
    ),
    configured: isFastSpringConfigured(),
  };
}

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !isSoloAdmin(profile)) return { error: "Admin only" as const };
  return { profile };
}

export async function adminUpdateBillingSettingsAction(input: {
  billingRequired?: boolean;
  shopperBillingRequired?: boolean;
  allowPastDueAccess?: boolean;
  allowFailedPaymentAccess?: boolean;
  checklist?: Partial<Record<BillingLaunchCheckId, boolean>>;
  approveLive?: boolean;
}) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const current = await getBillingSettings();
  const checklist = {
    ...(current.launch_checklist || {}),
    ...(input.checklist || {}),
  };
  let liveApproved = current.live_billing_approved;
  let liveApprovedAt = current.live_billing_approved_at;
  let liveApprovedBy = current.live_billing_approved_by;
  if (input.approveLive) {
    if (!launchChecklistComplete(checklist)) {
      return { error: "Confirm every launch check before enabling live billing." };
    }
    if (!isFastSpringLiveMode()) {
      return {
        error:
          "FASTSPRING_LIVE_MODE is still false. Leave it false until you are ready to charge.",
      };
    }
    liveApproved = true;
    liveApprovedAt = new Date().toISOString();
    liveApprovedBy = auth.profile.id;
  }
  if (input.billingRequired && !liveApproved) {
    return {
      error:
        "Do not require payment until live billing is approved. Stores stay on the free pilot.",
    };
  }
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { error } = await admin
    .from("billing_settings")
    .update({
      billing_required: input.billingRequired ?? current.billing_required,
      shopper_billing_required:
        input.shopperBillingRequired ?? current.shopper_billing_required,
      allow_past_due_access:
        input.allowPastDueAccess ?? current.allow_past_due_access,
      allow_failed_payment_access:
        input.allowFailedPaymentAccess ?? current.allow_failed_payment_access,
      launch_checklist: checklist,
      live_billing_approved: liveApproved,
      live_billing_approved_at: liveApprovedAt,
      live_billing_approved_by: liveApprovedBy,
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function adminStoreBillingAction(input: {
  storeId: string;
  action: "extend_trial" | "complimentary" | "suspend" | "restore";
  days?: number;
}) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: store } = await admin
    .from("stores")
    .select("id, trial_ends_at")
    .eq("id", input.storeId)
    .maybeSingle();
  if (!store) return { error: "Store not found" };
  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("store_id", input.storeId)
    .maybeSingle();

  if (input.action === "extend_trial") {
    const days = Math.min(Math.max(input.days ?? 30, 1), 180);
    const base = new Date(
      Math.max(
        Date.now(),
        new Date(sub?.trial_ends_at || store.trial_ends_at || Date.now()).getTime()
      )
    );
    base.setDate(base.getDate() + days);
    const trialEnds = base.toISOString();
    await admin
      .from("stores")
      .update({ trial_ends_at: trialEnds, subscription_status: "trial" })
      .eq("id", input.storeId);
    if (sub?.id) {
      await admin
        .from("subscriptions")
        .update({
          status: "trial",
          plan_id: "trial",
          trial_ends_at: trialEnds,
          access_override: "none",
        })
        .eq("id", sub.id);
    }
    return { ok: true as const };
  }

  if (input.action === "complimentary") {
    if (sub?.id) {
      await admin
        .from("subscriptions")
        .update({ access_override: "complimentary", status: "active", plan_id: "business" })
        .eq("id", sub.id);
    } else {
      await admin.from("subscriptions").insert({
        store_id: input.storeId,
        plan: "starter",
        plan_id: "business",
        status: "active",
        access_override: "complimentary",
      });
    }
    await admin
      .from("stores")
      .update({ subscription_status: "active", subscription_plan: "starter" })
      .eq("id", input.storeId);
    return { ok: true as const };
  }

  if (input.action === "suspend") {
    if (sub?.id) {
      await admin
        .from("subscriptions")
        .update({ access_override: "suspended", status: "suspended" })
        .eq("id", sub.id);
    }
    return { ok: true as const };
  }

  if (sub?.id) {
    await admin
      .from("subscriptions")
      .update({
        access_override: "none",
        status: sub.status === "suspended" ? "active" : sub.status,
      })
      .eq("id", sub.id);
  }
  return { ok: true as const };
}

export function billingLaunchChecks() {
  return BILLING_LAUNCH_CHECKS;
}
