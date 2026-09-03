import { cookies } from "next/headers";
import { isDemoMode } from "@/lib/config/env";
import {
  HUB_DEVICE_COOKIE,
  HUB_DEVICE_COOKIE_MAX_AGE,
  HUB_PAIRING_COOKIE,
} from "@/lib/hub/constants";
import {
  parseDeviceCookie,
  parsePairingCookie,
  serializeDeviceCookie,
  serializePairingCookie,
  sha256Hex,
} from "@/lib/hub/crypto";
import type { Store, StoreDevice } from "@/types/database";
import type { HubRelinkReason } from "@/lib/hub/relink";

export type HubDeviceSession = StoreDevice & { store: Store };

export type HubDeviceInspect =
  | { status: "linked"; session: HubDeviceSession }
  | { status: Exclude<HubRelinkReason, "missing"> | "absent" };

async function cookieJar() {
  return cookies();
}

export async function readHubDeviceCookie(): Promise<{
  deviceId: string;
  token: string;
} | null> {
  try {
    const jar = await cookieJar();
    return parseDeviceCookie(jar.get(HUB_DEVICE_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function readHubPairingCookie(): Promise<{
  pairingId: string;
  secret: string;
} | null> {
  try {
    const jar = await cookieJar();
    return parsePairingCookie(jar.get(HUB_PAIRING_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function setHubDeviceCookie(deviceId: string, token: string) {
  const jar = await cookieJar();
  jar.set(HUB_DEVICE_COOKIE, serializeDeviceCookie(deviceId, token), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: HUB_DEVICE_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearHubDeviceCookie() {
  const jar = await cookieJar();
  jar.delete(HUB_DEVICE_COOKIE);
}

export async function setHubPairingCookie(pairingId: string, secret: string) {
  const jar = await cookieJar();
  jar.set(HUB_PAIRING_COOKIE, serializePairingCookie(pairingId, secret), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 12,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearHubPairingCookie() {
  const jar = await cookieJar();
  jar.delete(HUB_PAIRING_COOKIE);
}

export async function inspectHubDeviceCookie(): Promise<HubDeviceInspect> {
  const parsed = await readHubDeviceCookie();
  if (!parsed) return { status: "absent" };

  if (isDemoMode()) {
    const { getDemoState } = await import("@/lib/demo/store");
    const device = getDemoState().storeDevices.find((d) => d.id === parsed.deviceId);
    if (!device || device.token_hash !== sha256Hex(parsed.token)) {
      await clearHubDeviceCookie();
      return { status: "invalid" };
    }
    if (device.revoked_at) {
      await clearHubDeviceCookie();
      return { status: "disconnected" };
    }
    const store = getDemoState().stores.find((s) => s.id === device.store_id);
    if (!store || store.is_suspended || !store.is_active) {
      await clearHubDeviceCookie();
      return { status: "store_unavailable" };
    }
    return { status: "linked", session: { ...device, store } };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: device } = await admin
    .from("store_devices")
    .select("*")
    .eq("id", parsed.deviceId)
    .maybeSingle();
  if (!device || device.token_hash !== sha256Hex(parsed.token)) {
    await clearHubDeviceCookie();
    return { status: "invalid" };
  }
  if (device.revoked_at) {
    await clearHubDeviceCookie();
    return { status: "disconnected" };
  }
  const { data: store } = await admin
    .from("stores")
    .select("*")
    .eq("id", device.store_id)
    .maybeSingle();
  if (!store || store.is_suspended || store.is_active === false) {
    await clearHubDeviceCookie();
    return { status: "store_unavailable" };
  }
  return { status: "linked", session: { ...(device as StoreDevice), store: store as Store } };
}

export async function getHubDeviceSession(): Promise<HubDeviceSession | null> {
  const result = await inspectHubDeviceCookie();
  return result.status === "linked" ? result.session : null;
}
