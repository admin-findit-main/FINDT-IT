import type { AccountType } from "@findit/types";

export type AppHomePath = "/admin" | "/store" | "/home";

export function resolveAppHome(input: {
  accountType: AccountType | string | null | undefined;
  hasActiveStoreMembership: boolean;
}): AppHomePath {
  if (input.accountType === "admin") return "/admin";
  if (input.accountType === "business" || input.hasActiveStoreMembership) {
    return "/store";
  }
  return "/home";
}

/** Allow only same-origin relative paths for post-login `?next=`. */
export function isSafeNextPath(next: string | null | undefined): next is string {
  if (!next) return false;
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  if (next.includes("://")) return false;
  return true;
}

export function workspaceLabel(input: {
  accountType: AccountType | string | null | undefined;
  hasActiveStoreMembership: boolean;
}): string {
  if (input.accountType === "admin") return "Admin";
  if (input.accountType === "business" || input.hasActiveStoreMembership) {
    return "Store";
  }
  return "Customer";
}
