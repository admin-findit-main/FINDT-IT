import { STORE_CATEGORIES } from "./constants";

/** Map a customer request category to store category labels that should receive it. */
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

export function normalizeCategoryLabel(value: string): string {
  return value.trim().toLowerCase();
}

export function categoriesOverlap(
  storeCategories: string[],
  allowedStoreCategories: string[]
): boolean {
  const store = new Set(storeCategories.map(normalizeCategoryLabel));
  return allowedStoreCategories.some((c) => store.has(normalizeCategoryLabel(c)));
}

/** Categories a store can opt into for incoming customer requests. */
export const JOIN_REQUEST_CATEGORIES = [
  "Grocery",
  "Beauty",
  "Electronics",
  "Convenience",
  "Auto Parts",
  "Clothing",
  "Collectibles",
  "Hardware",
  "Specialty",
  "Other",
] as const;

export type JoinRequestCategory = (typeof JOIN_REQUEST_CATEGORIES)[number];

export function isKnownStoreCategory(value: string): boolean {
  return (STORE_CATEGORIES as readonly string[]).includes(value);
}
