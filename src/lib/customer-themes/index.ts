import type { CustomerThemeId } from "@findit/types";

export type { CustomerThemeId };

export const CUSTOMER_THEME_IDS = [
  "default",
  "pooh",
  "dark",
  "seasonal",
  "custom",
] as const satisfies readonly CustomerThemeId[];

export function normalizeCustomerThemeId(
  value: string | null | undefined
): CustomerThemeId {
  if (
    value === "pooh" ||
    value === "dark" ||
    value === "seasonal" ||
    value === "custom"
  ) {
    return value;
  }
  return "default";
}

export function isSpecialCustomerTheme(id: CustomerThemeId): boolean {
  return id !== "default";
}
