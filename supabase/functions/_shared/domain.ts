/** Shared helpers for FINDIT Edge Functions (Deno).
 * Keep numeric caps in lockstep with packages/domain/src/constants.ts
 * (FREE_MONTHLY_REQUEST_LIMIT, PLUS_MONTHLY_REQUEST_LIMIT, FREE_MAX_RADIUS_MILES,
 * PLUS_MAX_RADIUS_MILES, STORE_PLANS.free.monthlyRequests, MAX_CUSTOMER_RADIUS_MILES).
 * The domain vitest `edge-sync` test fails if these literals drift.
 */

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

export const STORE_PLANS_FREE_MONTHLY = 20;
export const MAX_CUSTOMER_RADIUS_MILES = 40;
export const FREE_MONTHLY_REQUEST_LIMIT = 5;
export const PLUS_MONTHLY_REQUEST_LIMIT = 25;
export const PLUS_MAX_RADIUS_MILES = 40;
export const FREE_MAX_RADIUS_MILES = 10;

export function normalizeProductName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export function storeCategoriesForRequestCategory(
  requestCategory: string | null | undefined
): string[] | null {
  if (!requestCategory) return null;
  const key = requestCategory.trim().toLowerCase();
  const map: Record<string, string[]> = {
    grocery: ["Grocery", "Convenience"],
    beauty: ["Beauty"],
    electronics: ["Electronics"],
    convenience: ["Convenience", "Grocery"],
    auto: ["Auto Parts"],
    clothing: ["Clothing"],
    collectibles: ["Collectibles"],
    hardware: ["Hardware"],
    "tobacco & vape": ["Smoke Shop", "Convenience", "Tobacco & Vape"],
    coffee: ["Coffee Shop"],
    nails: ["Nail Salon", "Beauty"],
    specialty: ["Specialty Retail", "Other", "Specialty"],
    other: ["Other", "Specialty Retail", "Convenience", "Grocery"],
  };
  return map[key] || [requestCategory];
}

export const AGE_RESTRICTED_ID_REQUIRED =
  "Confirm you are 21 or older before asking stores for tobacco or vape products.";

export function isAgeRestrictedFind(input: {
  category?: string | null;
  productName?: string | null;
  description?: string | null;
}): boolean {
  const category = (input.category || "").trim().toLowerCase();
  if (category === "tobacco & vape" || category === "smoke shop") return true;
  const text = [input.category, input.productName, input.description]
    .map((part) => (part || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  if (!text) return false;
  const phrases = [
    "tobacco & vape",
    "smoke shop",
    "elf bar",
    "geek bar",
    "lost mary",
    "vape juice",
    "e-liquid",
    "salt nic",
    "nicotine pouch",
    "disposable vape",
  ];
  if (phrases.some((term) => text.includes(term))) return true;
  return /\b(vape|vapes|vaping|tobacco|cigarette|cigarettes|cigar|cigars|nicotine|hookah|shisha|zyn)\b/i.test(
    text
  );
}

function normalizeCategoryLabel(value: string): string {
  return value.trim().toLowerCase();
}

function categoriesOverlap(
  storeCategories: string[],
  allowedStoreCategories: string[]
): boolean {
  const store = new Set(storeCategories.map(normalizeCategoryLabel));
  return allowedStoreCategories.some((c) =>
    store.has(normalizeCategoryLabel(c))
  );
}

export const UNKNOWN_ZIP_DISTANCE_MILES = 99;
const EARTH_RADIUS_MILES = 3958.7613;

function zipFive(value: string): string {
  return value.trim().slice(0, 5);
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function finiteCoord(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateZipDistanceMiles(
  customerZip: string,
  storeZip: string,
  storeCity?: string | null,
  customerCity?: string | null
): number {
  const cZip = zipFive(customerZip);
  const sZip = zipFive(storeZip);
  if (!cZip || !sZip) return UNKNOWN_ZIP_DISTANCE_MILES;
  if (cZip === sZip) return 0;

  const samePrefix = cZip.slice(0, 3) === sZip.slice(0, 3);
  const cNum = /^\d{5}$/.test(cZip) ? Number(cZip) : NaN;
  const sNum = /^\d{5}$/.test(sZip) ? Number(sZip) : NaN;
  if (samePrefix && Number.isFinite(cNum) && Number.isFinite(sNum)) {
    const diff = Math.abs(cNum - sNum);
    if (diff <= 2) return 2;
    if (diff <= 10) return 4;
    return 6;
  }
  if (
    storeCity &&
    customerCity &&
    storeCity.trim().toLowerCase() === customerCity.trim().toLowerCase()
  ) {
    return 5;
  }
  return UNKNOWN_ZIP_DISTANCE_MILES;
}

export function estimateRoutingDistanceMiles(input: {
  customerZip: string;
  storeZip: string;
  customerCity?: string | null;
  storeCity?: string | null;
  customerLatitude?: number | string | null;
  customerLongitude?: number | string | null;
  storeLatitude?: number | string | null;
  storeLongitude?: number | string | null;
}): number {
  const customerLat = finiteCoord(input.customerLatitude);
  const customerLng = finiteCoord(input.customerLongitude);
  const storeLat = finiteCoord(input.storeLatitude);
  const storeLng = finiteCoord(input.storeLongitude);
  if (
    customerLat != null &&
    customerLng != null &&
    storeLat != null &&
    storeLng != null
  ) {
    return Math.round(haversineMiles(customerLat, customerLng, storeLat, storeLng) * 10) / 10;
  }
  return estimateZipDistanceMiles(
    input.customerZip,
    input.storeZip,
    input.storeCity,
    input.customerCity
  );
}

type RoutingStoreCandidate = {
  id: string;
  is_active: boolean;
  is_suspended: boolean;
  is_verified?: boolean;
  postal_code: string;
  city?: string | null;
  service_radius_miles: number;
  subscription_plan?: string;
  categories: string[];
  service_zips: string[];
  month_targets_received?: number;
  free_plan_monthly_cap?: number | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

function storeCoversCustomerZip(
  store: Pick<RoutingStoreCandidate, "postal_code" | "service_zips">,
  customerZip: string
): boolean {
  const zip = customerZip.trim().slice(0, 5);
  if (store.postal_code.trim().slice(0, 5) === zip) return true;
  return store.service_zips.some((z) => z.trim().slice(0, 5) === zip);
}

function isWithinMutualRadius(
  estimatedMiles: number,
  customerRadiusMiles: number,
  _storeRadiusMiles?: number
): boolean {
  const customerCap = Math.min(
    Math.max(customerRadiusMiles, 0),
    MAX_CUSTOMER_RADIUS_MILES
  );
  return estimatedMiles <= customerCap;
}

export function selectEligibleStores(input: {
  request: {
    id: string;
    postal_code: string;
    city?: string | null;
    category: string | null;
    radius_miles: number;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };
  stores: RoutingStoreCandidate[];
  alreadyTargetedStoreIds?: string[];
  bypassPlanCaps?: boolean;
}): { eligible: { storeId: string; estimatedMiles: number }[] } {
  const already = new Set(input.alreadyTargetedStoreIds || []);
  const allowedCategories = storeCategoriesForRequestCategory(
    input.request.category
  );
  const eligible: { storeId: string; estimatedMiles: number }[] = [];

  for (const store of input.stores) {
    if (already.has(store.id)) continue;
    if (!store.is_active || store.is_suspended) continue;

    if (allowedCategories && store.categories.length > 0) {
      if (!categoriesOverlap(store.categories, allowedCategories)) continue;
    }

    const est = estimateRoutingDistanceMiles({
      customerZip: input.request.postal_code,
      storeZip: store.postal_code,
      customerCity: input.request.city,
      storeCity: store.city,
      customerLatitude: input.request.latitude,
      customerLongitude: input.request.longitude,
      storeLatitude: store.latitude,
      storeLongitude: store.longitude,
    });

    if (!storeCoversCustomerZip(store, input.request.postal_code)) {
      if (est >= UNKNOWN_ZIP_DISTANCE_MILES) continue;
      if (
        !isWithinMutualRadius(
          est,
          input.request.radius_miles,
          store.service_radius_miles
        )
      ) {
        continue;
      }
    } else if (
      !isWithinMutualRadius(
        est,
        input.request.radius_miles,
        store.service_radius_miles
      )
    ) {
      continue;
    }

    if (
      !input.bypassPlanCaps &&
      store.subscription_plan === "free" &&
      store.free_plan_monthly_cap != null &&
      (store.month_targets_received || 0) >= store.free_plan_monthly_cap
    ) {
      continue;
    }

    eligible.push({ storeId: store.id, estimatedMiles: est });
  }

  return { eligible };
}

type StoreHourRow = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
};

function parseTimeToMinutes(value: string | null): number | null {
  if (!value) return null;
  const parts = value.slice(0, 5).split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function nextOpenTime(hours: StoreHourRow[], from: Date): Date | null {
  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(from);
    d.setDate(d.getDate() + offset);
    const day = d.getDay();
    const row = hours.find((h) => h.day_of_week === day);
    if (!row || row.is_closed) continue;
    const openM = parseTimeToMinutes(row.open_time);
    if (openM == null) continue;
    const candidate = new Date(d);
    candidate.setHours(Math.floor(openM / 60), openM % 60, 0, 0);
    if (candidate.getTime() > from.getTime()) return candidate;
  }
  return null;
}

export function isStoreOpenAt(
  hours: StoreHourRow[],
  at: Date = new Date()
): { open: boolean; reopenAt: Date | null } {
  const day = at.getDay();
  const mins = at.getHours() * 60 + at.getMinutes();
  const row = hours.find((h) => h.day_of_week === day);
  if (!row || row.is_closed) {
    return { open: false, reopenAt: nextOpenTime(hours, at) };
  }
  const openM = parseTimeToMinutes(row.open_time);
  const closeM = parseTimeToMinutes(row.close_time);
  if (openM == null || closeM == null) {
    return { open: false, reopenAt: null };
  }
  const open =
    closeM < openM ? mins >= openM || mins < closeM : mins >= openM && mins < closeM;
  return {
    open,
    reopenAt: open ? null : nextOpenTime(hours, at),
  };
}

export function deriveRequestStatus(input: {
  responseCount: number;
  targetCount: number;
  expired?: boolean;
  cancelled?: boolean;
  fulfilled?: boolean;
}): string {
  if (input.fulfilled) return "fulfilled";
  if (input.cancelled) return "cancelled";
  if (input.expired) return "expired";
  if (input.responseCount <= 0) return "active";
  if (input.targetCount > 0 && input.responseCount >= input.targetCount) {
    return "answered";
  }
  return "partially_answered";
}

export function responseTimeSeconds(
  routeSentAt: string | Date,
  respondedAt: string | Date = new Date()
): number {
  const start =
    typeof routeSentAt === "string" ? new Date(routeSentAt) : routeSentAt;
  const end =
    typeof respondedAt === "string" ? new Date(respondedAt) : respondedAt;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

export function corsHeaders(origin?: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  origin?: string | null
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}
