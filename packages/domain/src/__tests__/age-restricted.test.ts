import { describe, expect, it } from "vitest";
import {
  AGE_RESTRICTED_FIND_PLACEHOLDER,
  AGE_RESTRICTED_ID_REQUIRED,
  AGE_RESTRICTED_MINIMUM_AGE,
  AGE_RESTRICTED_PRODUCT_CATEGORY,
  AGE_RESTRICTED_STORE_CATEGORY,
  findPlaceholderForCategory,
  isAgeRestrictedFind,
  storeSelectionSuggestsCustomerId,
} from "../age-restricted";
import { PRODUCT_CATEGORIES, STORE_CATEGORIES } from "../constants";
import { storeCategoriesForRequestCategory } from "../category-routing";

describe("age-restricted Finds", () => {
  it("keeps Tobacco & Vape and Smoke Shop in the catalogs", () => {
    expect(PRODUCT_CATEGORIES).toContain(AGE_RESTRICTED_PRODUCT_CATEGORY);
    expect(STORE_CATEGORIES).toContain(AGE_RESTRICTED_STORE_CATEGORY);
    expect(AGE_RESTRICTED_MINIMUM_AGE).toBe(21);
  });

  it("routes tobacco Finds to smoke shops and convenience", () => {
    expect(storeCategoriesForRequestCategory("Tobacco & Vape")).toEqual([
      "Smoke Shop",
      "Convenience",
      "Tobacco & Vape",
    ]);
  });

  it("gates tobacco and vape by category or product wording", () => {
    expect(isAgeRestrictedFind({ category: "Tobacco & Vape" })).toBe(true);
    expect(
      isAgeRestrictedFind({ productName: "Elf Bar BC5000 Blue Razz Ice" })
    ).toBe(true);
    expect(isAgeRestrictedFind({ productName: "Zyn 6mg mint" })).toBe(true);
    expect(isAgeRestrictedFind({ productName: "Cherry Coke Zero 12-pack" })).toBe(
      false
    );
    expect(isAgeRestrictedFind({ productName: "orange juice" })).toBe(false);
  });

  it("asks smoke shops whether they check ID", () => {
    expect(
      storeSelectionSuggestsCustomerId({ businessType: "Smoke Shop" })
    ).toBe(true);
    expect(
      storeSelectionSuggestsCustomerId({
        businessType: "Grocery",
        requestCategories: ["Tobacco & Vape"],
      })
    ).toBe(true);
    expect(
      storeSelectionSuggestsCustomerId({
        businessType: "Grocery",
        requestCategories: ["Grocery"],
      })
    ).toBe(false);
    expect(findPlaceholderForCategory("Tobacco & Vape")).toBe(
      AGE_RESTRICTED_FIND_PLACEHOLDER
    );
    expect(AGE_RESTRICTED_ID_REQUIRED).toMatch(/21/);
  });
});
