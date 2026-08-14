export const PRODUCT_CATEGORIES = [
  "Grocery",
  "Beauty",
  "Electronics",
  "Convenience",
  "Auto",
  "Clothing",
  "Collectibles",
  "Hardware",
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
] as const;

export const STORE_SERVICE_RADIUS_OPTIONS = [
  { label: "2 miles", miles: 2 },
  { label: "5 miles", miles: 5 },
  { label: "10 miles", miles: 10 },
  { label: "15 miles", miles: 15 },
  { label: "25 miles", miles: 25 },
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

/** Days of free pilot after a store application is approved */
export const STORE_TRIAL_DAYS = 60;

/**
 * Customer plan definitions — do not hardcode prices in UI.
 * Soft monthly request limits apply unless FINDIT_BYPASS_PLAN_LIMITS=true.
 */
export const CUSTOMER_PLANS = {
  free: {
    id: "free",
    name: "FINDIT FREE",
    tagline: "Ask nearby stores — limited requests",
    priceMonthly: 0,
    monthlyRequests: 3,
    maxRadiusMiles: 10,
    savedSearches: false,
    requestHistory: false,
    futureAlerts: false,
  },
  plus: {
    id: "plus",
    name: "FINDIT+",
    tagline: "Unlimited asks, larger radius, saved searches",
    priceMonthly: 3.99,
    monthlyRequests: null as number | null,
    maxRadiusMiles: 25,
    savedSearches: true,
    requestHistory: true,
    futureAlerts: true,
  },
} as const;

export type CustomerPlanId = keyof typeof CUSTOMER_PLANS;

/**
 * Store plan definitions (per location) — do not hardcode prices in UI.
 * Approved stores start on a 60-day free trial/pilot, then Starter or Pro.
 */
export const STORE_PLANS = {
  free: {
    id: "free",
    name: "Pilot",
    tagline: "60-day free trial",
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
    name: "Starter",
    tagline: "Per location",
    monthlyRequests: null as number | null,
    analytics: true,
    multipleLocations: false,
    teamManagement: true,
    advancedAnalytics: false,
    priceMonthly: 29,
    trial: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Per location",
    monthlyRequests: null as number | null,
    analytics: true,
    multipleLocations: true,
    teamManagement: true,
    advancedAnalytics: true,
    priceMonthly: 59,
    trial: false,
  },
} as const;

export type PlanId = keyof typeof STORE_PLANS;
export type StorePlanId = PlanId;

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
