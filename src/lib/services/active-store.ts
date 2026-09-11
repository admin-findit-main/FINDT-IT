"use server";

import { boundUuid } from "@findit/domain";
import { cookies } from "next/headers";
import {
  getCurrentProfile,
  getUserStoresAction,
} from "@/lib/services/actions";

export const ACTIVE_STORE_COOKIE = "findit_active_store";

export async function setActiveStoreAction(storeId: string) {
  const id = boundUuid(storeId);
  if (!id) return { error: "Invalid store" };
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Unauthorized" };

  const stores = await getUserStoresAction();
  if (!stores.some((store) => store.id === id)) {
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
  return { ok: true as const };
}

export async function readActiveStoreCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(ACTIVE_STORE_COOKIE)?.value;
  return boundUuid(value || "") || null;
}
