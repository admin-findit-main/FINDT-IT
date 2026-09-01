/**
 * FINDIT request routing engine.
 * Pure functions — no AI. ZIP + category + activity + radius gates.
 */

import {
  categoriesOverlap,
  storeCategoriesForRequestCategory,
} from "./category-routing";
import { classifyRequest, matchKindForStore, type MatchKind } from "./classify";

export const STORE_RADIUS_OPTIONS = [2, 5, 10, 15, 25, 40] as const;
export type StoreRadiusMiles = (typeof STORE_RADIUS_OPTIONS)[number];

export const CUSTOMER_RADIUS_OPTIONS = [
  { label: "2 miles", miles: 2 },
  { label: "5 miles", miles: 5 },
  { label: "10 miles", miles: 10 },
  { label: "15 miles", miles: 15 },
  { label: "25 miles", miles: 25 },
  { label: "40 miles", miles: 40 },
] as const;

export const MAX_CUSTOMER_RADIUS_MILES = 40;
/** ZIP pairs we cannot relate by prefix/city — treat as out of area. */
export const UNKNOWN_ZIP_DISTANCE_MILES = 99;
const EARTH_RADIUS_MILES = 3958.7613;

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
  businessTypeId?: string | null;
  acceptingRequests?: boolean;
  catalogCategoryIds?: string[];
  catalogSubcategoryIds?: string[];
  catalogKeywordIds?: string[];
  customKeywords?: string[];
  /** Optional: monthly targets already received (for free plan caps) */
  month_targets_received?: number;
  free_plan_monthly_cap?: number | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface RoutingRequest {
  id: string;
  postal_code: string;
  city?: string | null;
  category: string | null;
  radius_miles: number;
  productName?: string | null;
  description?: string | null;
  categoryConfirmed?: boolean;
  detectedBusinessTypeId?: string | null;
  detectedCategoryId?: string | null;
  detectedSubcategoryId?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface RoutingDecision {
  storeId: string;
  reason: "eligible";
  estimatedMiles: number;
  wasClosedAtRoute?: boolean;
  matchKind?: MatchKind;
  routingReason?: string;
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
    | "already_targeted"
    | "not_accepting";
}

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

/** Great-circle miles between two WGS84 points. */
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

/**
 * Nearby ZIP heuristic when GPS is missing.
 * Adjacent codes like 20001 / 20002 are ~1–2 miles, not a blanket 8.
 */
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
  const cPrefix = Number(cZip.slice(0, 3));
  const sPrefix = Number(sZip.slice(0, 3));
  if (Number.isFinite(cPrefix) && Number.isFinite(sPrefix)) {
    const prefixDiff = Math.abs(cPrefix - sPrefix);
    if (prefixDiff === 1) return 8;
    if (prefixDiff === 2) return 12;
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

export const RESPONSE_TYPE_SORT_ORDER: Record<string, number> = {
  in_stock: 0,
  can_order: 1,
  out_of_stock: 2,
  not_relevant: 3,
};

export function formatEstimatedDistanceMiles(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return "Distance unknown";
  if (miles <= 0) return "Same ZIP";
  if (miles >= UNKNOWN_ZIP_DISTANCE_MILES) return "Farther away";
  return `About ${Math.round(miles)} mi`;
}

export type DistanceSortableResponse = {
  response_type: string;
  store?: {
    postal_code?: string | null;
    city?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  } | null;
};

/** Closest store first, then in-stock before can-order before out-of-stock. */
export function sortCustomerResponsesByDistance<T extends DistanceSortableResponse>(
  responses: T[],
  customerZip: string,
  customerCity?: string | null,
  customerPoint?: {
    latitude?: number | string | null;
    longitude?: number | string | null;
  }
): T[] {
  return [...responses].sort((a, b) => {
    const da = estimateRoutingDistanceMiles({
      customerZip,
      storeZip: a.store?.postal_code || "",
      customerCity,
      storeCity: a.store?.city,
      customerLatitude: customerPoint?.latitude,
      customerLongitude: customerPoint?.longitude,
      storeLatitude: a.store?.latitude,
      storeLongitude: a.store?.longitude,
    });
    const db = estimateRoutingDistanceMiles({
      customerZip,
      storeZip: b.store?.postal_code || "",
      customerCity,
      storeCity: b.store?.city,
      customerLatitude: customerPoint?.latitude,
      customerLongitude: customerPoint?.longitude,
      storeLatitude: b.store?.latitude,
      storeLongitude: b.store?.longitude,
    });
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
  _storeRadiusMiles?: number
): boolean {
  const customerCap = Math.min(
    Math.max(customerRadiusMiles, 0),
    MAX_CUSTOMER_RADIUS_MILES
  );
  return estimatedMiles <= customerCap;
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
  const classification = classifyRequest({
    productName: input.request.productName,
    description: input.request.description,
    category: input.request.category,
    confirmed: Boolean(input.request.categoryConfirmed || input.request.category),
  });
  const allowedCategories = storeCategoriesForRequestCategory(
    classification.productCategory || input.request.category
  );
  const eligible: RoutingDecision[] = [];
  const excluded: RoutingExclusion[] = [];
  const MATCH_RANK: Record<MatchKind, number> = {
    keyword: 0,
    subcategory: 1,
    category: 2,
    business_type: 3,
  };

  for (const store of input.stores) {
    if (already.has(store.id)) {
      excluded.push({ storeId: store.id, reason: "already_targeted" });
      continue;
    }
    if (!store.is_active) {
      excluded.push({ storeId: store.id, reason: "inactive" });
      continue;
    }
    if (store.acceptingRequests === false) {
      excluded.push({ storeId: store.id, reason: "not_accepting" });
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

    const matchKind = matchKindForStore({ classification, store });
    const hasCatalog =
      Boolean(store.businessTypeId) ||
      (store.catalogCategoryIds && store.catalogCategoryIds.length > 0);
    if (hasCatalog && classification.businessTypeId) {
      if (!matchKind) {
        excluded.push({ storeId: store.id, reason: "category" });
        continue;
      }
    } else if (allowedCategories && store.categories.length > 0) {
      if (!categoriesOverlap(store.categories, allowedCategories)) {
        excluded.push({ storeId: store.id, reason: "category" });
        continue;
      }
    }

    const estimatedMiles = estimateRoutingDistanceMiles({
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
      if (estimatedMiles >= UNKNOWN_ZIP_DISTANCE_MILES) {
        excluded.push({ storeId: store.id, reason: "service_area" });
        continue;
      }
      if (
        !isWithinMutualRadius(
          estimatedMiles,
          input.request.radius_miles,
          store.service_radius_miles
        )
      ) {
        excluded.push({ storeId: store.id, reason: "radius" });
        continue;
      }
    } else if (
      !isWithinMutualRadius(
        estimatedMiles,
        input.request.radius_miles,
        store.service_radius_miles
      )
    ) {
      excluded.push({ storeId: store.id, reason: "radius" });
      continue;
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

    eligible.push({
      storeId: store.id,
      reason: "eligible",
      estimatedMiles,
      matchKind: matchKind || "category",
      routingReason: classification.reason,
    });
  }

  eligible.sort((a, b) => {
    const ra = MATCH_RANK[a.matchKind || "business_type"];
    const rb = MATCH_RANK[b.matchKind || "business_type"];
    if (ra !== rb) return ra - rb;
    return a.estimatedMiles - b.estimatedMiles;
  });

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
