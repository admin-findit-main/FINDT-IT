import type { Store, StoreMemberRole } from "@findit/types";

export type StoreWorkspace = {
  store: (Store & { role: StoreMemberRole }) | null;
  role: StoreMemberRole;
  canManageStore: boolean;
  canInvite: boolean;
  isAdminViewer: boolean;
};

export function roleLabel(role: StoreMemberRole): string {
  if (role === "owner") return "Owner";
  if (role === "manager") return "Manager";
  return "Employee";
}

export function canManageFromRole(role: StoreMemberRole | string): boolean {
  return role === "owner" || role === "manager";
}

/** Routes only owners/managers should use as primary UX. */
export function isOwnerOnlyStorePath(pathname: string): boolean {
  return (
    pathname.startsWith("/store/demand") ||
    pathname.startsWith("/store/team") ||
    pathname.startsWith("/store/shifts") ||
    pathname.startsWith("/store/settings") ||
    pathname.startsWith("/store/subscription") ||
    pathname.startsWith("/store/devices") ||
    pathname.startsWith("/store/responses")
  );
}
