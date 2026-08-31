export type LoginAudience = "shopper" | "store";

/** Which login screen this account should use. Store staff and the operator stay on the business side. */
export function loginAudienceForAccount(input: {
  isAdmin?: boolean;
  accountType?: string | null;
  hasActiveStoreMembership?: boolean;
}): LoginAudience {
  if (
    input.isAdmin ||
    input.accountType === "admin" ||
    input.accountType === "business"
  ) {
    return "store";
  }
  if (input.hasActiveStoreMembership) return "store";
  return "shopper";
}

export function wrongLoginSideMessage(belongsOn: LoginAudience): string {
  if (belongsOn === "store") {
    return "This is a store login. Use Store sign in so FINDIT opens the business side.";
  }
  return "This is a shopper login. Use Shopper sign in so FINDIT opens the customer side.";
}
