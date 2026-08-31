import {
  HANDLED_FASTSPRING_EVENTS,
  inferBillingMethod,
  mapFastSpringSubscriptionState,
  redactPaymentPayload,
  type BillingAudience,
  type BillingMethod,
  type BillingPaymentStatus,
  type StoreBillingStatus,
} from "@findit/domain";
import { createServiceClient } from "@/lib/supabase/admin";

export type FastSpringWebhookEvent = {
  id?: string;
  type?: string;
  live?: boolean;
  created?: number;
  data?: Record<string, unknown>;
};

export type FastSpringWebhookBody = {
  events?: FastSpringWebhookEvent[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function msToIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  return null;
}

function tagsFrom(data: Record<string, unknown>): Record<string, string> {
  const tags = asRecord(data.tags);
  const orderTags = asRecord(data.orderTags);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...orderTags, ...tags })) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function firstSubscription(data: Record<string, unknown>): Record<string, unknown> {
  if (data.subscription && typeof data.subscription === "object") {
    return asRecord(data.subscription);
  }
  const items = Array.isArray(data.items) ? data.items : [];
  for (const item of items) {
    const rec = asRecord(item);
    if (rec.subscription) return asRecord(rec.subscription);
    if (Array.isArray(rec.subscriptions) && rec.subscriptions[0]) {
      return asRecord(rec.subscriptions[0]);
    }
  }
  if (Array.isArray(data.subscriptions) && data.subscriptions[0]) {
    return asRecord(data.subscriptions[0]);
  }
  return data;
}

function accountIdFrom(data: Record<string, unknown>): string | null {
  return (
    asString(data.account) ||
    asString(asRecord(data.account).id) ||
    asString(asRecord(data.customer).id)
  );
}

function paymentMethodFrom(data: Record<string, unknown>): BillingMethod {
  const payment = asRecord(data.payment);
  return inferBillingMethod(
    asString(payment.type) ||
      asString(data.paymentMethod) ||
      asString(data.paymentType)
  );
}

function amountCentsFrom(data: Record<string, unknown>): number | null {
  const total = data.total ?? data.totalInPayoutCurrency ?? asRecord(data.charge).total;
  if (typeof total === "number") return Math.round(total * 100);
  return null;
}

export type NormalizedBillingEvent = {
  eventId: string;
  type: string;
  live: boolean;
  audience: BillingAudience | null;
  storeId: string | null;
  profileId: string | null;
  accountId: string | null;
  subscriptionId: string | null;
  orderId: string | null;
  reference: string | null;
  invoiceUrl: string | null;
  status: StoreBillingStatus | null;
  paymentStatus: BillingPaymentStatus | null;
  billingMethod: BillingMethod;
  periodStart: string | null;
  periodEnd: string | null;
  nextPaymentAt: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  amountCents: number | null;
  recordInvoice: boolean;
};

export function normalizeFastSpringEvent(
  event: FastSpringWebhookEvent
): NormalizedBillingEvent | null {
  const type = asString(event.type);
  const eventId = asString(event.id);
  if (!type || !eventId) return null;
  if (!(HANDLED_FASTSPRING_EVENTS as readonly string[]).includes(type)) {
    return {
      eventId,
      type,
      live: event.live === true,
      audience: null,
      storeId: null,
      profileId: null,
      accountId: null,
      subscriptionId: null,
      orderId: null,
      reference: null,
      invoiceUrl: null,
      status: null,
      paymentStatus: null,
      billingMethod: "none",
      periodStart: null,
      periodEnd: null,
      nextPaymentAt: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      amountCents: null,
      recordInvoice: false,
    };
  }

  const data = asRecord(event.data);
  const sub = firstSubscription(data);
  const tags = { ...tagsFrom(data), ...tagsFrom(sub) };
  const audience =
    tags.findit_audience === "customer"
      ? "customer"
      : tags.findit_audience === "store"
        ? "store"
        : null;
  const subscriptionId =
    asString(sub.subscription) ||
    asString(sub.id) ||
    asString(data.subscription);
  const orderId = asString(data.order) || asString(data.id) || asString(sub.order);

  let status: StoreBillingStatus | null = null;
  let paymentStatus: BillingPaymentStatus | null = null;
  let cancelAtPeriodEnd = false;
  let canceledAt: string | null = null;
  let recordInvoice = false;

  switch (type) {
    case "subscription.activated":
      status = mapFastSpringSubscriptionState(asString(sub.state) || "active");
      if (status === "active") paymentStatus = "succeeded";
      break;
    case "subscription.updated":
    case "subscription.uncanceled":
    case "subscription.resumed":
      status = mapFastSpringSubscriptionState(asString(sub.state));
      cancelAtPeriodEnd = false;
      break;
    case "subscription.canceled":
      status = "canceled";
      cancelAtPeriodEnd = true;
      canceledAt = new Date().toISOString();
      break;
    case "subscription.deactivated":
      status = "expired";
      canceledAt = new Date().toISOString();
      break;
    case "subscription.paused":
      status = "suspended";
      break;
    case "subscription.payment.overdue":
      status = "past_due";
      paymentStatus = "failed";
      break;
    case "subscription.charge.completed":
      status = "active";
      paymentStatus = "succeeded";
      recordInvoice = true;
      break;
    case "subscription.charge.failed":
      status = "payment_failed";
      paymentStatus = "failed";
      recordInvoice = true;
      break;
    case "order.payment.pending":
      status = "pending_payment";
      paymentStatus = "processing";
      recordInvoice = true;
      break;
    case "order.completed":
      status = "active";
      paymentStatus = "succeeded";
      recordInvoice = true;
      break;
    case "order.failed":
      paymentStatus = "failed";
      status = "payment_failed";
      recordInvoice = true;
      break;
    case "order.canceled":
      paymentStatus = "returned";
      status = "payment_failed";
      recordInvoice = true;
      break;
    case "return.created":
      paymentStatus = "refunded";
      recordInvoice = true;
      break;
    default:
      break;
  }

  return {
    eventId,
    type,
    live: event.live === true,
    audience,
    storeId: tags.findit_store_id || null,
    profileId: tags.findit_profile_id || null,
    accountId: accountIdFrom(data) || accountIdFrom(sub),
    subscriptionId,
    orderId,
    reference: asString(data.reference) || asString(sub.reference),
    invoiceUrl: asString(data.invoiceUrl) || asString(sub.invoiceUrl),
    status,
    paymentStatus,
    billingMethod: paymentMethodFrom(data) || paymentMethodFrom(sub),
    periodStart: msToIso(sub.beginInSeconds ?? sub.begin ?? data.beginInSeconds),
    periodEnd: msToIso(
      sub.nextInSeconds ?? sub.next ?? sub.endInSeconds ?? data.nextInSeconds
    ),
    nextPaymentAt: msToIso(sub.nextInSeconds ?? sub.next),
    cancelAtPeriodEnd,
    canceledAt,
    amountCents: amountCentsFrom(data),
    recordInvoice,
  };
}

async function resolveStoreId(
  admin: ReturnType<typeof createServiceClient>,
  event: NormalizedBillingEvent
): Promise<string | null> {
  if (event.storeId) return event.storeId;
  if (event.subscriptionId) {
    const { data } = await admin
      .from("subscriptions")
      .select("store_id")
      .eq("provider_subscription_id", event.subscriptionId)
      .maybeSingle();
    if (data?.store_id) return data.store_id as string;
  }
  if (event.accountId) {
    const { data } = await admin
      .from("subscriptions")
      .select("store_id")
      .eq("provider_customer_id", event.accountId)
      .maybeSingle();
    if (data?.store_id) return data.store_id as string;
  }
  return null;
}

async function resolveProfileId(
  admin: ReturnType<typeof createServiceClient>,
  event: NormalizedBillingEvent
): Promise<string | null> {
  if (event.profileId) return event.profileId;
  if (event.subscriptionId) {
    const { data } = await admin
      .from("customer_subscriptions")
      .select("profile_id")
      .eq("provider_subscription_id", event.subscriptionId)
      .maybeSingle();
    if (data?.profile_id) return data.profile_id as string;
  }
  if (event.accountId) {
    const { data } = await admin
      .from("customer_subscriptions")
      .select("profile_id")
      .eq("provider_customer_id", event.accountId)
      .maybeSingle();
    if (data?.profile_id) return data.profile_id as string;
  }
  return null;
}

async function applyStoreEvent(
  admin: ReturnType<typeof createServiceClient>,
  event: NormalizedBillingEvent,
  storeId: string
) {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    provider: "fastspring",
    updated_at: new Date().toISOString(),
  };
  if (event.accountId) patch.provider_customer_id = event.accountId;
  if (event.subscriptionId) patch.provider_subscription_id = event.subscriptionId;
  if (event.status) {
    patch.status = event.status;
    patch.plan_id = event.status === "trial" ? "trial" : "business";
    patch.plan = event.status === "trial" ? "free" : "starter";
  }
  if (event.paymentStatus) patch.payment_status = event.paymentStatus;
  if (event.billingMethod !== "none") patch.billing_method = event.billingMethod;
  if (event.periodStart) patch.current_period_start = event.periodStart;
  if (event.periodEnd) {
    patch.current_period_end = event.periodEnd;
    patch.next_payment_at = event.nextPaymentAt || event.periodEnd;
  }
  if (event.type === "subscription.canceled") {
    patch.cancel_at_period_end = true;
    patch.canceled_at = event.canceledAt;
  }
  if (event.type === "subscription.uncanceled") {
    patch.cancel_at_period_end = false;
    patch.canceled_at = null;
  }
  if (event.type === "subscription.deactivated") {
    patch.cancel_at_period_end = false;
    patch.canceled_at = event.canceledAt;
  }
  if (event.paymentStatus === "succeeded") {
    patch.last_payment_at = new Date().toISOString();
    if (!existing?.subscription_started_at) {
      patch.subscription_started_at = new Date().toISOString();
    }
  }
  if (event.orderId) patch.last_order_id = event.orderId;
  if (event.invoiceUrl) patch.last_invoice_url = event.invoiceUrl;

  if (existing?.id) {
    await admin.from("subscriptions").update(patch).eq("id", existing.id);
  } else {
    await admin.from("subscriptions").insert({
      store_id: storeId,
      plan: "starter",
      plan_id: "business",
      status: event.status || "pending_payment",
      ...patch,
    });
  }

  const storePatch: Record<string, unknown> = {};
  if (event.status) {
    storePatch.subscription_status = event.status;
    storePatch.subscription_plan =
      event.status === "trial" || event.status === "expired"
        ? "free"
        : "starter";
  }
  if (event.periodEnd && event.status === "trial") {
    storePatch.trial_ends_at = event.periodEnd;
  }
  if (Object.keys(storePatch).length) {
    await admin.from("stores").update(storePatch).eq("id", storeId);
  }

  if (event.recordInvoice && event.orderId) {
    const { error } = await admin.from("billing_invoices").upsert(
      {
        audience: "store",
        store_id: storeId,
        provider: "fastspring",
        provider_order_id: event.orderId,
        provider_subscription_id: event.subscriptionId,
        reference: event.reference,
        amount_cents: event.amountCents,
        payment_method: event.billingMethod,
        payment_status: event.paymentStatus || "processing",
        invoice_url: event.invoiceUrl,
      },
      { onConflict: "provider,provider_order_id" }
    );
    if (error) {
      console.warn("[FINDIT] billing invoice upsert failed", error.message);
    }
  }
}

async function applyCustomerEvent(
  admin: ReturnType<typeof createServiceClient>,
  event: NormalizedBillingEvent,
  profileId: string
) {
  const { data: existing } = await admin
    .from("customer_subscriptions")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  const plusActive =
    event.status === "active" ||
    event.status === "pending_payment" ||
    event.status === "past_due" ||
    event.status === "trial";

  const patch: Record<string, unknown> = {
    provider: "fastspring",
    plan_id: plusActive || event.status === "canceled" ? "plus" : existing?.plan_id || "plus",
    updated_at: new Date().toISOString(),
  };
  if (event.accountId) patch.provider_customer_id = event.accountId;
  if (event.subscriptionId) patch.provider_subscription_id = event.subscriptionId;
  if (event.status) {
    patch.status =
      event.status === "expired" || event.status === "suspended"
        ? "inactive"
        : event.status;
  }
  if (event.paymentStatus) patch.payment_status = event.paymentStatus;
  if (event.billingMethod !== "none") patch.billing_method = event.billingMethod;
  if (event.periodStart) patch.current_period_start = event.periodStart;
  if (event.periodEnd) {
    patch.current_period_end = event.periodEnd;
    patch.next_payment_at = event.nextPaymentAt || event.periodEnd;
  }
  if (event.type === "subscription.canceled") {
    patch.cancel_at_period_end = true;
    patch.canceled_at = event.canceledAt;
  }
  if (event.type === "subscription.deactivated") {
    patch.status = "inactive";
    patch.plan_id = "free";
  }
  if (event.paymentStatus === "succeeded") {
    patch.last_payment_at = new Date().toISOString();
    patch.subscription_started_at =
      existing?.subscription_started_at || new Date().toISOString();
  }
  if (event.orderId) patch.last_order_id = event.orderId;
  if (event.invoiceUrl) patch.last_invoice_url = event.invoiceUrl;

  if (existing?.id) {
    await admin.from("customer_subscriptions").update(patch).eq("id", existing.id);
  } else {
    await admin.from("customer_subscriptions").insert({
      profile_id: profileId,
      ...patch,
    });
  }

  const plan =
    event.type === "subscription.deactivated" || event.status === "expired"
      ? "free"
      : plusActive || event.status === "canceled"
        ? "plus"
        : undefined;
  if (plan) {
    await admin.from("profiles").update({ subscription_plan: plan }).eq("id", profileId);
  }

  if (event.recordInvoice && event.orderId) {
    const { error } = await admin.from("billing_invoices").upsert(
      {
        audience: "customer",
        profile_id: profileId,
        provider: "fastspring",
        provider_order_id: event.orderId,
        provider_subscription_id: event.subscriptionId,
        reference: event.reference,
        amount_cents: event.amountCents,
        payment_method: event.billingMethod,
        payment_status: event.paymentStatus || "processing",
        invoice_url: event.invoiceUrl,
      },
      { onConflict: "provider,provider_order_id" }
    );
    if (error) {
      console.warn("[FINDIT] billing invoice upsert failed", error.message);
    }
  }
}

export async function processFastSpringWebhook(
  body: FastSpringWebhookBody
): Promise<{ accepted: number; duplicates: number; skipped: number }> {
  const admin = createServiceClient();
  const events = Array.isArray(body.events) ? body.events : [];
  let accepted = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const raw of events) {
    const event = normalizeFastSpringEvent(raw);
    if (!event) {
      skipped += 1;
      continue;
    }

    const { error: insertError } = await admin.from("billing_events").insert({
      provider: "fastspring",
      event_id: event.eventId,
      event_type: event.type,
      live: event.live,
      audience: event.audience,
      store_id: event.storeId,
      profile_id: event.profileId,
      provider_account_id: event.accountId,
      provider_subscription_id: event.subscriptionId,
      provider_order_id: event.orderId,
      payload: redactPaymentPayload(asRecord(raw)),
    });

    if (insertError) {
      if (insertError.code === "23505") {
        duplicates += 1;
        continue;
      }
      throw new Error(insertError.message);
    }

    const storeId = await resolveStoreId(admin, event);
    const profileId = await resolveProfileId(admin, event);
    const audience =
      event.audience || (storeId ? "store" : profileId ? "customer" : null);

    if (audience === "store" && storeId) {
      await applyStoreEvent(admin, event, storeId);
    } else if (audience === "customer" && profileId) {
      await applyCustomerEvent(admin, event, profileId);
    } else if (
      event.type.startsWith("subscription.") ||
      event.type.startsWith("order.")
    ) {
      console.warn("[FINDIT] FastSpring event had no matching account", {
        eventId: event.eventId,
        type: event.type,
      });
    }

    accepted += 1;
  }

  return { accepted, duplicates, skipped };
}
