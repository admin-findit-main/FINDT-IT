/** The only email allowed to hold `account_type = admin`. */
export const SOLO_ADMIN_EMAIL = "stirux.invest@gmail.com";

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
