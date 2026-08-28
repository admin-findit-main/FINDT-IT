export const PRODUCT_CATEGORIES = [
  "Grocery",
  "Beauty",
  "Electronics",
  "Convenience",
  "Auto",
  "Clothing",
  "Collectibles",
  "Hardware",
  "Tobacco & Vape",
  "Coffee",
  "Nails",
  "Specialty",
  "Other",
] as const;

export const STORE_CATEGORIES = [
  "Grocery",
  "Convenience",
  "Beauty",
  "Electronics",
  "Auto Parts",
  "Clothing",
  "Collectibles",
  "Hardware",
  "Smoke Shop",
  "Coffee Shop",
  "Nail Salon",
  "Specialty Retail",
  "Other",
] as const;

export const REQUEST_EXAMPLES = [
  "Black iPhone 16 case",
  "Specific hair product",
  "Blue Takis",
  "Canon battery",
  "Size 10 Nike Air Max",
] as const;

export const EXPIRATION_OPTIONS = [
  { label: "4 hours", hours: 4 },
  { label: "12 hours", hours: 12 },
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
] as const;

export const RADIUS_OPTIONS = [
  { label: "2 miles", miles: 2 },
  { label: "5 miles", miles: 5 },
  { label: "10 miles", miles: 10 },
  { label: "15 miles", miles: 15 },
  { label: "25 miles", miles: 25 },
  { label: "40 miles", miles: 40 },
] as const;

export const STORE_SERVICE_RADIUS_OPTIONS = [
  { label: "2 miles", miles: 2 },
  { label: "5 miles", miles: 5 },
  { label: "10 miles", miles: 10 },
  { label: "15 miles", miles: 15 },
  { label: "25 miles", miles: 25 },
  { label: "40 miles", miles: 40 },
] as const;

/** In-stock shelf amount (optional) */
export const STOCK_AMOUNT_OPTIONS = [
  { label: "Plenty", value: "plenty" },
  { label: "Few left", value: "few_left" },
  { label: "Last one", value: "last_one" },
] as const;

export const HOLD_OPTIONS = [
  { label: "No hold", minutes: null },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "Until closing", minutes: -1 },
] as const;

export const AVAILABILITY_OPTIONS = [
  "Today",
  "Tomorrow",
  "2–3 days",
  "This week",
  "Custom",
] as const;

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Days of free FINDIT+ Business trial after a store application is approved */
export const STORE_TRIAL_DAYS = 30;

/** FINDIT Free monthly Finds. Change here — do not scatter. */
export const FREE_MONTHLY_REQUEST_LIMIT = 5;

/**
 * FINDIT+ monthly Finds cap. Configurable product knob (not unlimited).
 * Change this single value when the Plus allowance is decided.
 */
export const PLUS_MONTHLY_REQUEST_LIMIT = 25;

/** Keep Edge `_shared/domain.ts` in lockstep with these radius caps. */
export const FREE_MAX_RADIUS_MILES = 10;
export const PLUS_MAX_RADIUS_MILES = 40;

/** FINDIT+ Business price after trial. Billing is not connected yet. */
export const BUSINESS_PRICE_MONTHLY = 49.99;

/**
 * Consumer plans — FINDIT+ is a PLAN, not a role.
 * Plus price is omitted until billing exists (do not invent checkout).
 */
export const CUSTOMER_PLANS = {
  free: {
    id: "free",
    name: "FINDIT",
    tagline: "Ask nearby stores — 5 Finds each month",
    priceMonthly: 0 as number | null,
    monthlyRequests: FREE_MONTHLY_REQUEST_LIMIT as number | null,
    maxRadiusMiles: FREE_MAX_RADIUS_MILES,
    savedSearches: false,
    requestHistory: true,
    futureAlerts: false,
  },
  plus: {
    id: "plus",
    name: "FINDIT+",
    tagline: "More Finds, 40-mile search, Expand Search",
    priceMonthly: null as number | null,
    monthlyRequests: PLUS_MONTHLY_REQUEST_LIMIT as number | null,
    maxRadiusMiles: PLUS_MAX_RADIUS_MILES,
    savedSearches: true,
    requestHistory: true,
    futureAlerts: true,
  },
} as const;

export type CustomerPlanId = keyof typeof CUSTOMER_PLANS;

/**
 * FINDIT+ Business: 30-day trial, then $49.99/month per location.
 * `starter` / `pro` keys remain so existing store rows still resolve.
 */
const FINDIT_PLUS_BUSINESS = {
  name: "FINDIT+ Business",
  tagline: "30-day free trial, then $49.99/month",
  monthlyRequests: null as number | null,
  analytics: true,
  multipleLocations: false,
  teamManagement: true,
  advancedAnalytics: true,
  priceMonthly: BUSINESS_PRICE_MONTHLY,
  trial: false,
};

export const STORE_PLANS = {
  free: {
    id: "free",
    name: "Trial",
    tagline: "30-day free trial",
    monthlyRequests: 20,
    analytics: true,
    multipleLocations: false,
    teamManagement: true,
    advancedAnalytics: false,
    priceMonthly: 0,
    trial: true,
  },
  starter: {
    id: "starter",
    ...FINDIT_PLUS_BUSINESS,
  },
  pro: {
    id: "pro",
    ...FINDIT_PLUS_BUSINESS,
  },
} as const;

export type PlanId = keyof typeof STORE_PLANS;
export type StorePlanId = PlanId;

/** Trial store monthly inbound-request cap used by routing. Keep Edge in lockstep. */
export const STORE_PLANS_FREE_MONTHLY = STORE_PLANS.free.monthlyRequests;

export const MAX_ACTIVE_REQUESTS_PER_HOUR = 10;
export const MAX_APPLICATIONS_PER_DAY = 3;
export const MIN_PRODUCT_NAME_LENGTH = 2;
export const MAX_PRODUCT_NAME_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const REQUEST_IMAGES_BUCKET = "request-images";

export const APP_NAME = "FINDIT";
export const APP_TAGLINE = "Who has it? FINDIT.";
export const APP_POSITIONING =
  "Looking for something? Ask nearby stores at once.";

/** Pilot messaging — no Stripe during pilot */
export const PILOT_STORE_BANNER =
  "Your store is part of the FINDIT Pilot. No payment is required during the pilot.";
export const PILOT_CUSTOMER_BADGE = "Beta";
