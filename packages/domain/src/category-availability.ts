import { catalogTypeById } from "./catalog";

/** Pilot categories intentionally exposed to customer category pickers. */
export const ROUTABLE_CATEGORY_ALLOWLIST = [
  "Tobacco & Vape",
  "Dispensary",
] as const;

export type RoutableCategoryLabel =
  (typeof ROUTABLE_CATEGORY_ALLOWLIST)[number];

export type RoutableCategoryCount = {
  label: RoutableCategoryLabel;
  count: number;
};

export type CategoryAvailabilityStore = {
  is_active: boolean;
  is_suspended: boolean;
  accepting_requests: boolean;
  business_type: string | null;
};

/**
 * Returns only aggregate pilot labels/counts. Unknown business types and
 * categories outside the pilot allowlist are ignored.
 */
export function routableCategoryCounts(
  stores: CategoryAvailabilityStore[]
): RoutableCategoryCount[] {
  const counts = new Map<RoutableCategoryLabel, number>();
  for (const store of stores) {
    if (
      !store.is_active ||
      store.is_suspended ||
      !store.accepting_requests
    ) {
      continue;
    }
    const type = catalogTypeById(store.business_type);
    if (!type) continue;
    const label = ROUTABLE_CATEGORY_ALLOWLIST.find(
      (item) => item === type.productCategory
    );
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return ROUTABLE_CATEGORY_ALLOWLIST.flatMap((label) => {
    const count = counts.get(label) || 0;
    return count > 0 ? [{ label, count }] : [];
  });
}
