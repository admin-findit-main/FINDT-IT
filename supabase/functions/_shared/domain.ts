/** Shared helpers for FINDIT Edge Functions (Deno). */

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

export const STORE_PLANS_FREE_MONTHLY = 20;
export const MAX_CUSTOMER_RADIUS_MILES = 25;

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
    specialty: ["Specialty Retail", "Other", "Specialty"],
    other: ["Other", "Specialty Retail", "Convenience", "Grocery"],
  };
  return map[key] || [requestCategory];
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

export function estimateZipDistanceMiles(
  customerZip: string,
  storeZip: string,
  storeCity?: string | null,
  customerCity?: string | null
): number {
  const cZip = customerZip.trim().slice(0, 5);
  const sZip = storeZip.trim().slice(0, 5);
  if (cZip === sZip) return 0;
  if (cZip.slice(0, 3) === sZip.slice(0, 3)) return 8;
  if (
    storeCity &&
    customerCity &&
    storeCity.trim().toLowerCase() === customerCity.trim().toLowerCase()
  ) {
    return 5;
  }
  return 99;
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
  storeRadiusMiles: number
): boolean {
  const customerCap = Math.min(customerRadiusMiles, MAX_CUSTOMER_RADIUS_MILES);
  const storeCap = Math.min(storeRadiusMiles, MAX_CUSTOMER_RADIUS_MILES);
  return estimatedMiles <= customerCap && estimatedMiles <= storeCap;
}

export function selectEligibleStores(input: {
  request: {
    id: string;
    postal_code: string;
    city?: string | null;
    category: string | null;
    radius_miles: number;
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

    const est = estimateZipDistanceMiles(
      input.request.postal_code,
      store.postal_code,
      store.city,
      input.request.city
    );

    if (!storeCoversCustomerZip(store, input.request.postal_code)) {
      if (est >= 99) continue;
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
