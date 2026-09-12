"use server";

import { boundUuid, canManageFromRole } from "@findit/domain";
import { cookies } from "next/headers";
import { ACTIVE_STORE_COOKIE } from "@/lib/services/active-store-cookie";
import {
  getCurrentProfile,
  getUserStoresAction,
} from "@/lib/services/actions";

export async function setActiveStoreAction(storeId: string) {
  const id = boundUuid(storeId);
  if (!id) return { error: "Invalid store" };
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized" };

  const stores = await getUserStoresAction();
  const match = stores.find((store) => store.id === id);
  if (!match) {
    return { error: "You don’t have access to that location." };
  }

  const jar = await cookies();
  jar.set(ACTIVE_STORE_COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 400,
  });
  const role = match.role || "employee";
  return {
    ok: true as const,
    storeId: id,
    role,
    canManage: canManageFromRole(role),
  };
}
