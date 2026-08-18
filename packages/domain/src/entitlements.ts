import {
  BUSINESS_PRICE_MONTHLY,
  CUSTOMER_PLANS,
  RADIUS_OPTIONS,
  STORE_TRIAL_DAYS,
  type CustomerPlanId,
} from "./constants";

export type ConsumerEntitlements = {
  planId: CustomerPlanId;
  brandName: string;
  monthlyRequestLimit: number;
  maxSearchRadiusMiles: number;
  canExpandSearch: boolean;
  canSaveProducts: boolean;
  canUseProductWatch: boolean;
  requestHistory: boolean;
};

export function consumerPlanId(
  subscriptionPlan: string | null | undefined
): CustomerPlanId {
  return subscriptionPlan === "plus" ? "plus" : "free";
}

/** Derive consumer capabilities from plan. Do not copy these checks into screens. */
export function getConsumerEntitlements(
  subscriptionPlan: string | null | undefined
): ConsumerEntitlements {
  const planId = consumerPlanId(subscriptionPlan);
  const plan = CUSTOMER_PLANS[planId];
  const monthlyRequestLimit = plan.monthlyRequests ?? 5;
  return {
    planId,
    brandName: plan.name,
    monthlyRequestLimit,
    maxSearchRadiusMiles: plan.maxRadiusMiles,
    canExpandSearch: planId === "plus",
    canSaveProducts: plan.savedSearches,
    canUseProductWatch: false,
    requestHistory: plan.requestHistory,
  };
}

export function planLimitReachedMessage(entitlements: ConsumerEntitlements): string {
  if (entitlements.planId === "plus") {
    return `FINDIT+ includes ${entitlements.monthlyRequestLimit} Finds per month.`;
  }
  return `You've used your ${entitlements.monthlyRequestLimit} free Finds this month.`;
}

export function radiusLimitMessage(entitlements: ConsumerEntitlements): string {
  return `${entitlements.brandName} searches up to ${entitlements.maxSearchRadiusMiles} miles.`;
}

/** Radius chips allowed for this plan. Do not offer a wider option in the UI. */
export function radiusOptionsForPlan(maxSearchRadiusMiles: number) {
  return RADIUS_OPTIONS.filter((o) => o.miles <= maxSearchRadiusMiles);
}

/**
 * A Find is spent when it is created. Cancel, expire, or fulfill does not
 * give it back — that was the loop around the free monthly cap.
 */
export function countsTowardMonthlyFindCap(_status?: string | null): boolean {
  return true;
}

export function monthlyFindWindowStart(now = new Date()): Date {
  const start = new Date(now.getTime());
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function createdInMonthlyFindWindow(
  createdAt: string,
  now = new Date()
): boolean {
  return new Date(createdAt) >= monthlyFindWindowStart(now);
}

export function isMonthlyFindCapError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /Finds (this|per) month/i.test(message);
}

export function customerPlanPriceLabel(planId: CustomerPlanId): string {
  const price = CUSTOMER_PLANS[planId].priceMonthly;
  if (price === 0) return "Free";
  if (price == null) return "Not for sale yet";
  return `$${price.toFixed(2)} / month`;
}

export type CustomerPlanCompare = {
  id: CustomerPlanId;
  name: string;
  tagline: string;
  priceLabel: string;
  who: string;
  pros: string[];
  cons: string[];
};

/** Copy for the customer Plan screen. Do not invent a FINDIT+ checkout price. */
export function customerPlanCatalog(): {
  billingLive: boolean;
  plans: CustomerPlanCompare[];
  business: {
    name: string;
    priceLabel: string;
    detail: string;
  };
} {
  const free = CUSTOMER_PLANS.free;
  const plus = CUSTOMER_PLANS.plus;
  return {
    billingLive: plus.priceMonthly != null,
    plans: [
      {
        id: "free",
        name: free.name,
        tagline: free.tagline,
        priceLabel: customerPlanPriceLabel("free"),
        who: "For occasional asks near home.",
        pros: [
          `${free.monthlyRequests} Finds each month`,
          `Ask stores up to ${free.maxRadiusMiles} miles`,
          "In Stock, Out of Stock, and Can Order replies",
          "Request history",
          "No card required",
        ],
        cons: [
          "Five Finds is a hard monthly cap — canceling does not return one",
          `Cannot search past ${free.maxRadiusMiles} miles`,
          "No Expand Search if nearby stores don’t have it",
          "No saved searches",
        ],
      },
      {
        id: "plus",
        name: plus.name,
        tagline: plus.tagline,
        priceLabel: customerPlanPriceLabel("plus"),
        who: "For people who ask often or need a wider area.",
        pros: [
          `${plus.monthlyRequests} Finds each month`,
          `Search up to ${plus.maxRadiusMiles} miles`,
          "Expand Search when nothing nearby has it",
          "Saved searches",
          "Same FINDIT account — not a new login",
        ],
        cons: [
          "Still a monthly cap — not unlimited",
          "Canceling a Find still spends it",
          "A wider radius only helps if stores in that range participate",
          plus.priceMonthly == null
            ? "Billing is not live, so FINDIT+ cannot be purchased yet"
            : "Paid each month after you subscribe",
        ],
      },
    ],
    business: {
      name: "FINDIT+ Business",
      priceLabel: `$${BUSINESS_PRICE_MONTHLY.toFixed(2)} / month after a ${STORE_TRIAL_DAYS}-day trial`,
      detail:
        "For stores, not customers. Owners apply separately. Floor staff join with an invite.",
    },
  };
}
