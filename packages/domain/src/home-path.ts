import type { AccountType } from "@findit/types";
import {
  coerceSoloAdminProfile,
  isSoloAdmin,
  isSoloAdminEmail,
  SOLO_ADMIN_EMAIL,
} from "./admin";

export type AppHomePath = "/admin" | "/store" | "/home";

export const OPERATOR_HOME_PATH: AppHomePath = "/admin";
export const STORE_HOME_PATH: AppHomePath = "/store";
export const CUSTOMER_HOME_PATH: AppHomePath = "/home";
export const PASSWORD_UPDATE_PATH = "/auth/update-password";

export function resolveAppHome(input: {
  accountType: AccountType | string | null | undefined;
  hasActiveStoreMembership: boolean;
}): AppHomePath {
  if (input.accountType === "admin") return OPERATOR_HOME_PATH;
  if (input.accountType === "business" || input.hasActiveStoreMembership) {
    return STORE_HOME_PATH;
  }
  return CUSTOMER_HOME_PATH;
}

/** Allow only same-origin relative paths for post-login `?next=`. */
export function isSafeNextPath(next: string | null | undefined): next is string {
  if (!next) return false;
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  if (next.includes("://")) return false;
  return true;
}

export function isPasswordUpdatePath(pathname: string): boolean {
  return (
    pathname === PASSWORD_UPDATE_PATH ||
    pathname.startsWith(`${PASSWORD_UPDATE_PATH}/`)
  );
}

export function isCustomerSurfacePath(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  return (
    path === "/home" ||
    path.startsWith("/home/") ||
    path.startsWith("/requests") ||
    path.startsWith("/notifications") ||
    path.startsWith("/profile") ||
    path.startsWith("/plan") ||
    path.startsWith("/welcome")
  );
}

/**
 * Single post-auth destination for web login, signup, OTP, callbacks, and
 * password reset. Operator email always wins over `?next=/home`.
 */
export function resolvePostAuthDestination(input: {
  profile?: { email?: string | null; account_type?: string | null } | null;
  authEmail?: string | null;
  hasActiveStoreMembership?: boolean;
  next?: string | null;
  needsName?: boolean;
}): string {
  const coerced = coerceSoloAdminProfile(
    {
      email: input.profile?.email ?? null,
      account_type: input.profile?.account_type ?? null,
    },
    input.authEmail
  );

  if (isSafeNextPath(input.next) && isPasswordUpdatePath(input.next)) {
    return PASSWORD_UPDATE_PATH;
  }

  if (isSoloAdmin(coerced) || isSoloAdminEmail(input.authEmail)) {
    return OPERATOR_HOME_PATH;
  }

  if (input.needsName) return "/welcome";

  const home = resolveAppHome({
    accountType: coerced.account_type,
    hasActiveStoreMembership: Boolean(input.hasActiveStoreMembership),
  });

  if (home === STORE_HOME_PATH) {
    if (
      isSafeNextPath(input.next) &&
      (input.next.startsWith("/store") || input.next.startsWith("/invite/"))
    ) {
      return input.next;
    }
    return STORE_HOME_PATH;
  }

  if (isSafeNextPath(input.next) && !input.next.startsWith("/admin")) {
    return input.next;
  }

  return home;
}

export function isRecoveryAuthType(type: string | null | undefined): boolean {
  return type === "recovery";
}

export function destinationAfterEmailLink(input: {
  type?: string | null;
  next?: string | null;
  email?: string | null;
  homePath?: string | null;
}): string {
  if (
    isRecoveryAuthType(input.type) ||
    (isSafeNextPath(input.next) && isPasswordUpdatePath(input.next))
  ) {
    return PASSWORD_UPDATE_PATH;
  }
  return destinationAfterAuth({
    homePath: input.homePath,
    next: input.next,
    email: input.email,
  });
}

/** Client helper when the server already returned a workspace homePath. */
export function destinationAfterAuth(input: {
  homePath?: string | null;
  next?: string | null;
  needsName?: boolean;
  email?: string | null;
}): string {
  if (isSafeNextPath(input.next) && isPasswordUpdatePath(input.next)) {
    return PASSWORD_UPDATE_PATH;
  }
  if (isSoloAdminEmail(input.email)) return OPERATOR_HOME_PATH;
  const homePath = (input.homePath || CUSTOMER_HOME_PATH) as AppHomePath;
  return resolvePostAuthDestination({
    profile: {
      email: homePath === OPERATOR_HOME_PATH ? SOLO_ADMIN_EMAIL : null,
      account_type:
        homePath === OPERATOR_HOME_PATH
          ? "admin"
          : homePath === STORE_HOME_PATH
            ? "business"
            : "customer",
    },
    authEmail: input.email,
    next: input.next,
    needsName: input.needsName,
  });
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
