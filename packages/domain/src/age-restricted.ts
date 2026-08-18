import { PRODUCT_CATEGORIES, STORE_CATEGORIES } from "./constants";

export const AGE_RESTRICTED_PRODUCT_CATEGORY = "Tobacco & Vape" satisfies
  (typeof PRODUCT_CATEGORIES)[number];

export const AGE_RESTRICTED_STORE_CATEGORY = "Smoke Shop" satisfies
  (typeof STORE_CATEGORIES)[number];

/** US tobacco / nicotine purchase age. Stores still check ID in person. */
export const AGE_RESTRICTED_MINIMUM_AGE = 21;

export const AGE_RESTRICTED_ID_TITLE = "This product needs an ID";

export const AGE_RESTRICTED_ID_BODY =
  "Tobacco and vape Finds are for people 21 or older. Nearby stores will check a government ID when you pick it up. FINDIT never collects a photo of your ID.";

export const AGE_RESTRICTED_ID_CONFIRM =
  "I’m 21 or older and will show ID at the store";

export const AGE_RESTRICTED_ID_REQUIRED =
  "Confirm you are 21 or older before asking stores for tobacco or vape products.";

export const AGE_RESTRICTED_FIND_HINT =
  "Name the brand, flavor, nicotine, and size. Stores cannot guess — example: Elf Bar BC5000 Blue Razz Ice 5%.";

export const AGE_RESTRICTED_FIND_PLACEHOLDER = "Elf Bar BC5000 Blue Razz Ice 5%";

const PHRASE_TERMS = [
  "tobacco & vape",
  "smoke shop",
  "elf bar",
  "geek bar",
  "lost mary",
  "juicy bar",
  "vape juice",
  "e-liquid",
  "e liquid",
  "ejuice",
  "salt nic",
  "nicotine pouch",
  "disposable vape",
] as const;

const WORD_TERMS = [
  "vape",
  "vapes",
  "vaping",
  "tobacco",
  "cigarette",
  "cigarettes",
  "cigar",
  "cigars",
  "cigarillo",
  "nicotine",
  "hookah",
  "shisha",
  "zyn",
] as const;

function haystack(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (part || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

export function isAgeRestrictedCategory(
  category: string | null | undefined
): boolean {
  const value = (category || "").trim().toLowerCase();
  return (
    value === AGE_RESTRICTED_PRODUCT_CATEGORY.toLowerCase() ||
    value === AGE_RESTRICTED_STORE_CATEGORY.toLowerCase()
  );
}

/** True when the Find is tobacco, vape, or nicotine — even if no category was picked. */
export function isAgeRestrictedFind(input: {
  category?: string | null;
  productName?: string | null;
  description?: string | null;
}): boolean {
  if (isAgeRestrictedCategory(input.category)) return true;
  const text = haystack([input.category, input.productName, input.description]);
  if (!text) return false;
  if (PHRASE_TERMS.some((term) => text.includes(term))) return true;
  return WORD_TERMS.some((term) => new RegExp(`\\b${term}\\b`, "i").test(text));
}

export function findPlaceholderForCategory(
  category: string | null | undefined
): string {
  return isAgeRestrictedCategory(category)
    ? AGE_RESTRICTED_FIND_PLACEHOLDER
    : "Cherry Coke Zero 12-pack";
}

/** Default the store-application ID question when they sell age-restricted goods. */
export function storeSelectionSuggestsCustomerId(input: {
  businessType?: string | null;
  requestCategories?: string[] | null;
}): boolean {
  if (isAgeRestrictedCategory(input.businessType)) return true;
  return (input.requestCategories || []).some((category) =>
    isAgeRestrictedCategory(category)
  );
}
