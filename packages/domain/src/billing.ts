import { BUSINESS_PRICE_MONTHLY, PLUS_PRICE_MONTHLY } from "./constants";

export const BILLING_PROVIDER = "fastspring" as const;

/** Purchase is configured, but shopper checkout stays off until launch. */
export const SHOPPER_BILLING_LIVE = false;

export const BILLING_PLANS = {
  business: {
    id: "business",
    audience: "store" as const,
    name: "FINDIT Business",
    priceMonthly: BUSINESS_PRICE_MONTHLY,
    interval: "month" as const,
    preferredPaymentMethod: "ACH" as const,
    storePlanAliases: ["starter", "pro", "business"] as const,
  },
  plus: {
    id: "plus",
    audience: "customer" as const,
    name: "FINDIT+",
    priceMonthly: PLUS_PRICE_MONTHLY,
    interval: "month" as const,
    preferredPaymentMethod: "CARD" as const,
  },
} as const;

export type BillingPlanId = keyof typeof BILLING_PLANS;
export type BillingAudience = "store" | "customer";

export const STORE_BILLING_STATUSES = [
  "trial",
  "pending_payment",
  "active",
  "past_due",
  "payment_failed",
  "canceled",
  "expired",
  "suspended",
] as const;

export type StoreBillingStatus = (typeof STORE_BILLING_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "none",
  "pending",
  "processing",
  "succeeded",
  "failed",
  "returned",
  "refunded",
] as const;

export type BillingPaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const BILLING_METHODS = ["none", "ach", "card", "other"] as const;
export type BillingMethod = (typeof BILLING_METHODS)[number];

export const ACCESS_OVERRIDES = ["none", "complimentary", "suspended"] as const;
export type BillingAccessOverride = (typeof ACCESS_OVERRIDES)[number];

export const STORE_BILLING_STATUS_LABELS: Record<StoreBillingStatus, string> = {
  trial: "Free Trial",
  pending_payment: "Payment Processing",
  active: "Active",
  past_due: "Past Due",
  payment_failed: "Payment Failed",
  canceled: "Canceled",
  expired: "Expired",
  suspended: "Suspended",
};

export const PAYMENT_STATUS_LABELS: Record<BillingPaymentStatus, string> = {
  none: "None",
  pending: "Pending",
  processing: "Processing",
  succeeded: "Paid",
  failed: "Failed",
  returned: "Returned",
  refunded: "Refunded",
};

export const BILLING_METHOD_LABELS: Record<BillingMethod, string> = {
  none: "Not set",
  ach: "Bank account (ACH)",
  card: "Card",
  other: "Other",
};

export type BillingAccessRules = {
  billingRequired: boolean;
  allowPastDueAccess: boolean;
  allowFailedPaymentAccess: boolean;
  allowPendingPaymentAccess: boolean;
};

export const DEFAULT_BILLING_ACCESS_RULES: BillingAccessRules = {
  billingRequired: false,
  allowPastDueAccess: true,
  allowFailedPaymentAccess: true,
  allowPendingPaymentAccess: true,
};

export type StoreBillingSnapshot = {
  status: StoreBillingStatus | string | null;
  paymentStatus?: BillingPaymentStatus | string | null;
  accessOverride?: BillingAccessOverride | string | null;
  cancelAtPeriodEnd?: boolean | null;
  currentPeriodEnd?: string | Date | null;
};

export type StoreOperatingAccess = {
  allowed: boolean;
  reason:
    | "pilot"
    | "complimentary"
    | "trial"
    | "pending_payment"
    | "active"
    | "past_due_grace"
    | "failed_grace"
    | "period_remaining"
    | "billing_required"
    | "suspended"
    | "expired"
    | "canceled";
};

function asStatus(value: string | null | undefined): StoreBillingStatus {
  if (value && (STORE_BILLING_STATUSES as readonly string[]).includes(value)) {
    return value as StoreBillingStatus;
  }
  if (value === "free" || value === "trialing") return "trial";
  if (value === "processing" || value === "pending") return "pending_payment";
  if (!value) return "trial";
  return "active";
}

/** Operating access. Pending ACH never locks a store. Pilot keeps everyone in. */
export function storeOperatingAccess(
  snapshot: StoreBillingSnapshot,
  rules: BillingAccessRules = DEFAULT_BILLING_ACCESS_RULES,
  now = new Date()
): StoreOperatingAccess {
  if (!rules.billingRequired) {
    return { allowed: true, reason: "pilot" };
  }
  if (snapshot.accessOverride === "complimentary") {
    return { allowed: true, reason: "complimentary" };
  }
  if (snapshot.accessOverride === "suspended") {
    return { allowed: false, reason: "suspended" };
  }

  const status = asStatus(snapshot.status);
  if (status === "trial") return { allowed: true, reason: "trial" };
  if (status === "active") return { allowed: true, reason: "active" };
  if (status === "pending_payment") {
    return rules.allowPendingPaymentAccess
      ? { allowed: true, reason: "pending_payment" }
      : { allowed: false, reason: "billing_required" };
  }
  if (status === "past_due") {
    return rules.allowPastDueAccess
      ? { allowed: true, reason: "past_due_grace" }
      : { allowed: false, reason: "billing_required" };
  }
  if (status === "payment_failed") {
    return rules.allowFailedPaymentAccess
      ? { allowed: true, reason: "failed_grace" }
      : { allowed: false, reason: "billing_required" };
  }
  if (status === "suspended") return { allowed: false, reason: "suspended" };
  if (status === "expired") return { allowed: false, reason: "expired" };

  if (status === "canceled") {
    const end = snapshot.currentPeriodEnd
      ? new Date(snapshot.currentPeriodEnd)
      : null;
    if (snapshot.cancelAtPeriodEnd && end && end.getTime() > now.getTime()) {
      return { allowed: true, reason: "period_remaining" };
    }
    return { allowed: false, reason: "canceled" };
  }

  return { allowed: true, reason: "active" };
}

export type FastSpringEventType =
  | "subscription.activated"
  | "subscription.updated"
  | "subscription.canceled"
  | "subscription.uncanceled"
  | "subscription.deactivated"
  | "subscription.charge.completed"
  | "subscription.charge.failed"
  | "subscription.payment.overdue"
  | "subscription.paused"
  | "subscription.resumed"
  | "order.completed"
  | "order.payment.pending"
  | "order.failed"
  | "order.canceled"
  | "return.created"
  | "account.created"
  | "account.updated";

export const HANDLED_FASTSPRING_EVENTS = [
  "subscription.activated",
  "subscription.updated",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.deactivated",
  "subscription.charge.completed",
  "subscription.charge.failed",
  "subscription.payment.overdue",
  "subscription.paused",
  "subscription.resumed",
  "order.completed",
  "order.payment.pending",
  "order.failed",
  "order.canceled",
  "return.created",
  "account.created",
  "account.updated",
] as const satisfies readonly FastSpringEventType[];

export function mapFastSpringSubscriptionState(
  state: string | null | undefined
): StoreBillingStatus {
  const value = (state || "").toLowerCase();
  if (value === "trial" || value === "trialing") return "trial";
  if (value === "active") return "active";
  if (value === "overdue" || value === "past_due") return "past_due";
  if (value === "canceled" || value === "cancelled") return "canceled";
  if (value === "deactivated" || value === "inactive") return "expired";
  if (value === "paused") return "suspended";
  return "active";
}

export function inferBillingMethod(
  value: string | null | undefined
): BillingMethod {
  const raw = (value || "").toLowerCase();
  if (!raw) return "none";
  if (raw.includes("ach") || raw.includes("bank") || raw.includes("echeck")) {
    return "ach";
  }
  if (raw.includes("card") || raw.includes("visa") || raw.includes("master")) {
    return "card";
  }
  return "other";
}

export function storePlanIdForBilling(plan: string | null | undefined): string {
  if (!plan || plan === "free") return "free";
  if (
    (BILLING_PLANS.business.storePlanAliases as readonly string[]).includes(plan)
  ) {
    return "starter";
  }
  return plan;
}

export const BILLING_LAUNCH_CHECKS = [
  {
    id: "fastspring_verified",
    label: "FastSpring account is fully verified and approved.",
  },
  {
    id: "legal_entity",
    label: "FIND IT LLC business information is correct.",
  },
  { id: "ein", label: "EIN/business information is correct." },
  {
    id: "payout_bank",
    label: "FINDIT bank payout information is correct.",
  },
  { id: "ach_enabled", label: "ACH is enabled and working." },
  {
    id: "products_configured",
    label: "Products/plans are configured correctly.",
  },
  {
    id: "business_price",
    label: "$99/month Business subscription is correct.",
  },
  {
    id: "plus_price",
    label: "$4.99/month FINDIT+ subscription is correct.",
  },
  { id: "webhooks_tested", label: "Webhooks have been tested." },
  {
    id: "payments_success",
    label: "Successful payments have been tested.",
  },
  { id: "payments_failed", label: "Failed payments have been tested." },
  { id: "ach_pending", label: "ACH pending states have been tested." },
  { id: "ach_returns", label: "ACH returns/failures have been tested." },
  { id: "cancellation", label: "Cancellation has been tested." },
  { id: "renewal", label: "Renewal has been tested." },
  { id: "admin_tools", label: "Admin billing tools work." },
  {
    id: "authz",
    label: "Users cannot access another user's billing information.",
  },
  {
    id: "no_raw_credentials",
    label: "No raw payment credentials are stored by FINDIT.",
  },
  {
    id: "monitoring",
    label: "Production monitoring/logging is working.",
  },
  {
    id: "launch_approved",
    label: "Billing is explicitly approved for launch.",
  },
] as const;

export type BillingLaunchCheckId = (typeof BILLING_LAUNCH_CHECKS)[number]["id"];

export function launchChecklistComplete(
  checks: Partial<Record<BillingLaunchCheckId, boolean>> | null | undefined
): boolean {
  return BILLING_LAUNCH_CHECKS.every((item) => checks?.[item.id] === true);
}

export function canApproveLiveBilling(input: {
  checklist: Partial<Record<BillingLaunchCheckId, boolean>> | null | undefined;
  liveEnvEnabled: boolean;
}): { ok: boolean; reason: string } {
  if (!launchChecklistComplete(input.checklist)) {
    return {
      ok: false,
      reason: "Every launch check must be confirmed before live billing.",
    };
  }
  if (!input.liveEnvEnabled) {
    return {
      ok: false,
      reason: "FASTSPRING_LIVE_MODE must stay false until you are ready to charge.",
    };
  }
  return { ok: true, reason: "" };
}

export function formatMoney(amount: number): string {
  return Number.isInteger(amount)
    ? `$${amount}`
    : `$${amount.toFixed(2)}`;
}

export const SENSITIVE_PAYMENT_KEYS = [
  "accountnumber",
  "account_number",
  "routingnumber",
  "routing_number",
  "bankaccount",
  "iban",
  "cardnumber",
  "card_number",
  "cvv",
  "cvc",
  "securitycode",
  "security_code",
  "pan",
] as const;

export function redactPaymentPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPaymentPayload);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (
      SENSITIVE_PAYMENT_KEYS.some((item) => normalized.includes(item.replace(/_/g, "")))
    ) {
      out[key] = "[redacted]";
    } else {
      out[key] = redactPaymentPayload(nested);
    }
  }
  return out;
}
