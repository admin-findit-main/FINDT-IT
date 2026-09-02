/** The only email allowed to hold `account_type = admin` (Google Workspace). */
export const SOLO_ADMIN_EMAIL = "ali@askfindit.com";

/** Public inbox for reports, Find outcomes, and in-app like/dislike. */
export const SUPPORT_EMAIL = "support@askfindit.com";

export function isSoloAdminEmail(email: string | null | undefined): boolean {
  return (email || "").trim().toLowerCase() === SOLO_ADMIN_EMAIL;
}

export function isSoloAdmin(profile: {
  email?: string | null;
  account_type?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  return profile.account_type === "admin" && isSoloAdminEmail(profile.email);
}

/** Auth email wins if the profile row is missing or stale. */
export function coerceSoloAdminProfile<
  T extends { email?: string | null; account_type?: string | null },
>(profile: T, authEmail?: string | null): T {
  const email = (profile.email || authEmail || "").trim();
  if (isSoloAdminEmail(email)) {
    return { ...profile, email, account_type: "admin" };
  }
  if (profile.account_type === "admin") {
    return { ...profile, account_type: "customer" };
  }
  return profile;
}

/** Shopper app/web only — operator email is never a customer. */
export function isShopperAccount(
  profile: {
    email?: string | null;
    account_type?: string | null;
  } | null | undefined,
  authEmail?: string | null
): boolean {
  if (!profile && !authEmail) return false;
  const coerced = coerceSoloAdminProfile(
    profile || { email: authEmail ?? null, account_type: null },
    authEmail
  );
  return coerced.account_type === "customer";
}
