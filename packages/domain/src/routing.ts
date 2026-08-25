/**
 * FINDIT request routing engine.
 * Pure functions — no AI. ZIP + category + activity + radius gates.
 */

import {
  categoriesOverlap,
  storeCategoriesForRequestCategory,
} from "./category-routing";

export const STORE_RADIUS_OPTIONS = [2, 5, 10, 15, 25] as const;
export type StoreRadiusMiles = (typeof STORE_RADIUS_OPTIONS)[number];

export const CUSTOMER_RADIUS_OPTIONS = [
  { label: "2 miles", miles: 2 },
  { label: "5 miles", miles: 5 },
  { label: "10 miles", miles: 10 },
  { label: "15 miles", miles: 15 },
  { label: "25 miles", miles: 25 },
] as const;

export const MAX_CUSTOMER_RADIUS_MILES = 25;

export interface RoutingStoreCandidate {
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
  /** Optional: monthly targets already received (for free plan caps) */
  month_targets_received?: number;
  free_plan_monthly_cap?: number | null;
}

export interface RoutingRequest {
  id: string;
  postal_code: string;
  city?: string | null;
  category: string | null;
  radius_miles: number;
}

export interface RoutingDecision {
  storeId: string;
  reason: "eligible";
  estimatedMiles: number;
  wasClosedAtRoute?: boolean;
}

export interface RoutingExclusion {
  storeId: string;
  reason:
    | "inactive"
    | "suspended"
    | "category"
    | "service_area"
    | "radius"
    | "plan_cap"
    | "already_targeted";
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
  // Same 3-digit ZIP prefix ≈ nearby metro (rough local heuristic)
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

export const RESPONSE_TYPE_SORT_ORDER: Record<string, number> = {
  in_stock: 0,
  can_order: 1,
  out_of_stock: 2,
};

export function formatEstimatedDistanceMiles(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return "Distance unknown";
  if (miles <= 0) return "Same ZIP";
  if (miles >= 99) return "Farther away";
  return `About ${Math.round(miles)} mi`;
}

export type DistanceSortableResponse = {
  response_type: string;
  store?: {
    postal_code?: string | null;
    city?: string | null;
  } | null;
};

/** Closest store first, then in-stock before can-order before out-of-stock. */
export function sortCustomerResponsesByDistance<T extends DistanceSortableResponse>(
  responses: T[],
  customerZip: string,
  customerCity?: string | null
): T[] {
  return [...responses].sort((a, b) => {
    const da = estimateZipDistanceMiles(
      customerZip,
      a.store?.postal_code || "",
      a.store?.city,
      customerCity
    );
    const db = estimateZipDistanceMiles(
      customerZip,
      b.store?.postal_code || "",
      b.store?.city,
      customerCity
    );
    if (da !== db) return da - db;
    return (
      (RESPONSE_TYPE_SORT_ORDER[a.response_type] ?? 9) -
      (RESPONSE_TYPE_SORT_ORDER[b.response_type] ?? 9)
    );
  });
}

export function storeCoversCustomerZip(
  store: Pick<RoutingStoreCandidate, "postal_code" | "service_zips">,
  customerZip: string
): boolean {
  const zip = customerZip.trim().slice(0, 5);
  if (store.postal_code.trim().slice(0, 5) === zip) return true;
  return store.service_zips.some((z) => z.trim().slice(0, 5) === zip);
}

export function isWithinMutualRadius(
  estimatedMiles: number,
  customerRadiusMiles: number,
  storeRadiusMiles: number
): boolean {
  const customerCap = Math.min(customerRadiusMiles, MAX_CUSTOMER_RADIUS_MILES);
  const storeCap = Math.min(storeRadiusMiles, MAX_CUSTOMER_RADIUS_MILES);
  return estimatedMiles <= customerCap && estimatedMiles <= storeCap;
}

export function selectEligibleStores(input: {
  request: RoutingRequest;
  stores: RoutingStoreCandidate[];
  alreadyTargetedStoreIds?: Set<string> | string[];
  bypassPlanCaps?: boolean;
  requireVerified?: boolean;
}): { eligible: RoutingDecision[]; excluded: RoutingExclusion[] } {
  const already = new Set(
    Array.isArray(input.alreadyTargetedStoreIds)
      ? input.alreadyTargetedStoreIds
      : [...(input.alreadyTargetedStoreIds || [])]
  );
  const allowedCategories = storeCategoriesForRequestCategory(input.request.category);
  const eligible: RoutingDecision[] = [];
  const excluded: RoutingExclusion[] = [];

  for (const store of input.stores) {
    if (already.has(store.id)) {
      excluded.push({ storeId: store.id, reason: "already_targeted" });
      continue;
    }
    if (!store.is_active) {
      excluded.push({ storeId: store.id, reason: "inactive" });
      continue;
    }
    if (store.is_suspended) {
      excluded.push({ storeId: store.id, reason: "suspended" });
      continue;
    }
    if (input.requireVerified && store.is_verified === false) {
      excluded.push({ storeId: store.id, reason: "inactive" });
      continue;
    }

    if (allowedCategories && store.categories.length > 0) {
      if (!categoriesOverlap(store.categories, allowedCategories)) {
        excluded.push({ storeId: store.id, reason: "category" });
        continue;
      }
    }

    if (!storeCoversCustomerZip(store, input.request.postal_code)) {
      // Allow same-city fallback only when mutual radius is generous
      const est = estimateZipDistanceMiles(
        input.request.postal_code,
        store.postal_code,
        store.city,
        input.request.city
      );
      if (est >= 99) {
        excluded.push({ storeId: store.id, reason: "service_area" });
        continue;
      }
      if (
        !isWithinMutualRadius(
          est,
          input.request.radius_miles,
          store.service_radius_miles
        )
      ) {
        excluded.push({ storeId: store.id, reason: "radius" });
        continue;
      }
    } else {
      const est = estimateZipDistanceMiles(
        input.request.postal_code,
        store.postal_code,
        store.city,
        input.request.city
      );
      if (
        !isWithinMutualRadius(
          est,
          input.request.radius_miles,
          store.service_radius_miles
        )
      ) {
        excluded.push({ storeId: store.id, reason: "radius" });
        continue;
      }
    }

    if (
      !input.bypassPlanCaps &&
      store.subscription_plan === "free" &&
      store.free_plan_monthly_cap != null &&
      (store.month_targets_received || 0) >= store.free_plan_monthly_cap
    ) {
      excluded.push({ storeId: store.id, reason: "plan_cap" });
      continue;
    }

    const estimatedMiles = estimateZipDistanceMiles(
      input.request.postal_code,
      store.postal_code,
      store.city,
      input.request.city
    );

    eligible.push({
      storeId: store.id,
      reason: "eligible",
      estimatedMiles,
    });
  }

  return { eligible, excluded };
}

/** Privacy-safe payload stores see for a request (no customer PII). */
export function privacySafeRequestPayload(request: {
  id: string;
  product_name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  city: string;
  state: string;
  postal_code: string;
  created_at: string;
  expires_at: string;
}) {
  return {
    id: request.id,
    product_name: request.product_name,
    description: request.description,
    image_url: request.image_url,
    category: request.category,
    area_city: request.city,
    area_state: request.state,
    area_postal_prefix: request.postal_code.slice(0, 3),
    created_at: request.created_at,
    expires_at: request.expires_at,
  };
}
