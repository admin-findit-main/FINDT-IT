"use server";

import { cache } from "react";
import type { Store, StoreDevice, StoreMemberRole } from "@/types/database";
import { isDemoMode, appUrl } from "@/lib/config/env";
import { isSoloAdmin } from "@/lib/auth/admin";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/audit";
import { HUB_DEVICE_ONLINE_MS, HUB_PAIRING_TTL_MS } from "@/lib/hub/constants";
import {
  deviceIsOnline,
  generatePairingCode,
  generateSecret,
  hashPairingCode,
  normalizePairingCode,
  sha256Hex,
} from "@/lib/hub/crypto";
import {
  clearHubDeviceCookie,
  clearHubPairingCookie,
  getHubDeviceSession,
  inspectHubDeviceCookie,
  readHubPairingCookie,
  setHubDeviceCookie,
  setHubPairingCookie,
  type HubDeviceInspect,
} from "@/lib/hub/session";
import { getCurrentProfile, getStoreWorkspaceAction } from "@/lib/services/actions";
import { boundUuid } from "@findit/domain";
import type { HubRelinkReason } from "@/lib/hub/relink";

export type HubRuntime = {
  store: Store;
  source: "device" | "member";
  role: StoreMemberRole;
  canManage: boolean;
  deviceName: string | null;
  deviceId: string | null;
};

export type StoreDeviceView = {
  id: string;
  store_id: string;
  device_name: string;
  paired_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  enabled: boolean;
  online: boolean;
};

async function requireStoreManager(storeId?: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Please sign in" as const, profile: null, storeId: null };
  const workspace = await getStoreWorkspaceAction();
  const id = storeId || workspace?.store?.id;
  if (!id) return { error: "No store is linked to this account." as const, profile, storeId: null };
  if (isSoloAdmin(profile)) return { profile, storeId: id };
  if (!workspace?.canManageStore || workspace.store?.id !== id) {
    return { error: "Only owners and managers can manage devices." as const, profile, storeId: null };
  }
  return { profile, storeId: id };
}

function runtimeFromWorkspace(
  workspace: NonNullable<Awaited<ReturnType<typeof getStoreWorkspaceAction>>>
): HubRuntime {
  return {
    store: workspace.store!,
    source: "member",
    role: workspace.role,
    canManage: workspace.canManageStore,
    deviceName: null,
    deviceId: null,
  };
}

function runtimeFromDevice(
  device: Extract<HubDeviceInspect, { status: "linked" }>["session"]
): HubRuntime {
  return {
    store: device.store,
    source: "device",
    role: "employee",
    canManage: false,
    deviceName: device.device_name,
    deviceId: device.id,
  };
}

export const getHubRuntimeAction = cache(async (): Promise<HubRuntime | null> => {
  const resolved = await resolveHubTerminalAction();
  return resolved.ok ? resolved.runtime : null;
});

export async function resolveHubTerminalAction(): Promise<
  { ok: true; runtime: HubRuntime } | { ok: false; reason: HubRelinkReason }
> {
  const workspace = await getStoreWorkspaceAction();
  if (workspace?.store) {
    return { ok: true, runtime: runtimeFromWorkspace(workspace) };
  }
  const device = await inspectHubDeviceCookie();
  if (device.status === "linked") {
    return { ok: true, runtime: runtimeFromDevice(device.session) };
  }
  if (device.status === "absent") return { ok: false, reason: "missing" };
  return { ok: false, reason: device.status };
}

export async function createHubPairingAction(): Promise<
  { code: string; expiresAt: string; pairUrl: string } | { error: string }
> {
  const limited = await consumeRateLimit({
    bucket: "hub-pairing",
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (!limited.ok) return { error: limited.error };

  if (isDemoMode()) {
    const { demoCreateHubPairing } = await import("@/lib/demo/store");
    const created = demoCreateHubPairing();
    await setHubPairingCookie(created.pairingId, created.secret);
    return {
      code: created.code,
      expiresAt: created.expiresAt,
      pairUrl: `${appUrl()}/store/devices?pair=${created.code}`,
    };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const secret = generateSecret();
  let code = generatePairingCode();
  const expiresAt = new Date(Date.now() + HUB_PAIRING_TTL_MS).toISOString();

  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await admin
      .from("device_pairing_codes")
      .insert({
        code_hash: hashPairingCode(code),
        requester_secret_hash: sha256Hex(secret),
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (!error && data) {
      await setHubPairingCookie(data.id, secret);
      return {
        code,
        expiresAt,
        pairUrl: `${appUrl()}/store/devices?pair=${code}`,
      };
    }
    code = generatePairingCode();
  }
  return { error: "Couldn't start pairing. Try again." };
}

export async function pollHubPairingAction(): Promise<
  | { status: "pending" }
  | { status: "paired"; storeName: string }
  | { error: string }
> {
  const cookie = await readHubPairingCookie();
  if (!cookie) {
    const session = await getHubDeviceSession();
    if (session) return { status: "paired", storeName: session.store.name };
    return { error: "This screen is not waiting to pair." };
  }

  if (isDemoMode()) {
    const { demoRedeemHubPairing, getDemoState } = await import("@/lib/demo/store");
    const result = demoRedeemHubPairing(cookie);
    if ("pending" in result && result.pending) return { status: "pending" };
    if ("error" in result) {
      const session = await getHubDeviceSession();
      if (session) return { status: "paired", storeName: session.store.name };
      return { error: result.error };
    }
    await setHubDeviceCookie(result.deviceId, result.token);
    await clearHubPairingCookie();
    const store = getDemoState().stores.find((s) => s.id === result.storeId);
    return { status: "paired", storeName: store?.name || "Store" };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: pairing } = await admin
    .from("device_pairing_codes")
    .select("*")
    .eq("id", cookie.pairingId)
    .maybeSingle();
  if (!pairing || pairing.requester_secret_hash !== sha256Hex(cookie.secret)) {
    return { error: "This screen is not the one that started pairing." };
  }
  if (!pairing.used_at || !pairing.device_id || !pairing.store_id) {
    if (new Date(pairing.expires_at).getTime() <= Date.now()) {
      return { error: "That code expired. Generate a new one." };
    }
    return { status: "pending" };
  }

  if (pairing.issued_token) {
    const token = pairing.issued_token as string;
    await admin
      .from("device_pairing_codes")
      .update({ issued_token: null })
      .eq("id", pairing.id)
      .eq("device_id", pairing.device_id);

    await setHubDeviceCookie(pairing.device_id, token);
    await clearHubPairingCookie();
  } else {
    const session = await getHubDeviceSession();
    if (session?.id !== pairing.device_id) {
      return { error: "This pairing was already used." };
    }
  }

  const { data: store } = await admin
    .from("stores")
    .select("name")
    .eq("id", pairing.store_id)
    .maybeSingle();
  return { status: "paired", storeName: store?.name || "Store" };
}

export async function previewHubPairingAction(rawCode: string) {
  const code = normalizePairingCode(rawCode);
  if (!code) return { error: "Enter the 6-digit code from the device." };
  const manager = await requireStoreManager();
  if (manager.error || !manager.storeId) return { error: manager.error || "Unauthorized" };
  const limited = await consumeRateLimit({
    bucket: "hub-claim",
    limit: 20,
    windowMs: 15 * 60_000,
    key: manager.profile?.id || manager.storeId,
  });
  if (!limited.ok) return { error: limited.error };

  if (isDemoMode()) {
    const { demoLookupHubPairing, getDemoState } = await import("@/lib/demo/store");
    const pairing = demoLookupHubPairing(code);
    if (!pairing) return { error: "That code is invalid or expired." };
    const store = getDemoState().stores.find((s) => s.id === manager.storeId);
    return { storeName: store?.name || "Store", storeId: manager.storeId };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: pairing } = await admin
    .from("device_pairing_codes")
    .select("id, used_at, expires_at")
    .eq("code_hash", hashPairingCode(code))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!pairing) return { error: "That code is invalid or expired." };
  const { data: store } = await admin
    .from("stores")
    .select("name")
    .eq("id", manager.storeId)
    .maybeSingle();
  return { storeName: store?.name || "Store", storeId: manager.storeId };
}

export async function claimHubPairingAction(input: {
  code: string;
  deviceName: string;
}) {
  const code = normalizePairingCode(input.code);
  if (!code) return { error: "Enter the 6-digit code from the device." };
  const name = input.deviceName.trim().slice(0, 80);
  if (!name) return { error: "Name this device." };
  const manager = await requireStoreManager();
  if (manager.error || !manager.storeId || !manager.profile) {
    return { error: manager.error || "Unauthorized" };
  }
  const limited = await consumeRateLimit({
    bucket: "hub-claim",
    limit: 10,
    windowMs: 15 * 60_000,
    key: manager.profile.id,
  });
  if (!limited.ok) return { error: limited.error };

  if (isDemoMode()) {
    const { demoClaimHubPairing } = await import("@/lib/demo/store");
    const result = demoClaimHubPairing({
      code,
      storeId: manager.storeId,
      deviceName: name,
      pairedBy: manager.profile.id,
    });
    if ("error" in result) return result;
    return { ok: true as const, device: toView(result.device) };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: pairing } = await admin
    .from("device_pairing_codes")
    .select("*")
    .eq("code_hash", hashPairingCode(code))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!pairing) return { error: "That code is invalid or expired." };

  const token = generateSecret();
  const { data: device, error: deviceError } = await admin
    .from("store_devices")
    .insert({
      store_id: manager.storeId,
      device_name: name,
      token_hash: sha256Hex(token),
      paired_by: manager.profile.id,
      last_seen_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (deviceError || !device) return { error: "Couldn't connect this device." };

  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("device_pairing_codes")
    .update({
      used_at: claimedAt,
      store_id: manager.storeId,
      device_id: device.id,
      issued_token: token,
    })
    .eq("id", pairing.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (claimError || !claimed) {
    await admin.from("store_devices").delete().eq("id", device.id);
    return { error: "That code was already used." };
  }
  void logSecurityEvent({
    actorId: manager.profile.id,
    action: "hub_device_paired",
    resource: device.id,
    metadata: { storeId: manager.storeId },
  });
  return { ok: true as const, device: toView(device as StoreDevice) };
}

export async function listStoreDevicesAction(): Promise<StoreDeviceView[]> {
  const manager = await requireStoreManager();
  if (manager.error || !manager.storeId) return [];

  if (isDemoMode()) {
    const { demoListStoreDevices } = await import("@/lib/demo/store");
    return demoListStoreDevices(manager.storeId).map(toView);
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("store_devices")
    .select("*")
    .eq("store_id", manager.storeId)
    .order("paired_at", { ascending: false });
  return ((data || []) as StoreDevice[]).map(toView);
}

export async function renameStoreDeviceAction(deviceId: string, deviceName: string) {
  const name = deviceName.trim().slice(0, 80);
  if (!name) return { error: "Name this device." };
  const manager = await requireStoreManager();
  if (manager.error || !manager.storeId) return { error: manager.error || "Unauthorized" };

  if (isDemoMode()) {
    const { demoRenameStoreDevice } = await import("@/lib/demo/store");
    const result = demoRenameStoreDevice(manager.storeId, deviceId, name);
    if ("error" in result) return result;
    return { ok: true as const, device: toView(result) };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("store_devices")
    .update({ device_name: name, updated_at: new Date().toISOString() })
    .eq("id", deviceId)
    .eq("store_id", manager.storeId)
    .is("revoked_at", null)
    .select("*")
    .maybeSingle();
  if (error || !data) return { error: "Couldn't rename that device." };
  return { ok: true as const, device: toView(data as StoreDevice) };
}

export async function setStoreDeviceEnabledAction(
  deviceId: string,
  enabled: boolean
) {
  const id = boundUuid(deviceId);
  if (!id) return { error: "Device not found." };
  const manager = await requireStoreManager();
  if (manager.error || !manager.storeId) return { error: manager.error || "Unauthorized" };

  if (isDemoMode()) {
    const { demoSetStoreDeviceEnabled } = await import("@/lib/demo/store");
    const result = demoSetStoreDeviceEnabled(manager.storeId, id, enabled);
    if ("error" in result) return result;
    return { ok: true as const, device: toView(result) };
  }

  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("store_devices")
    .update({
      revoked_at: enabled ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("store_id", manager.storeId)
    .select("*")
    .maybeSingle();
  if (error || !data) return { error: "Couldn't update that device." };
  void logSecurityEvent({
    actorId: manager.profile?.id,
    action: enabled ? "hub_device_enabled" : "hub_device_disabled",
    resource: id,
    metadata: { storeId: manager.storeId },
  });
  return { ok: true as const, device: toView(data as StoreDevice) };
}

export async function revokeStoreDeviceAction(deviceId: string) {
  return setStoreDeviceEnabledAction(deviceId, false);
}

export async function touchHubDeviceAction(): Promise<
  { ok: true } | { ok: false; reason: HubRelinkReason }
> {
  const linked = await resolveHubTerminalAction();
  if (!linked.ok) return linked;
  if (linked.runtime.source !== "device" || !linked.runtime.deviceId) {
    return { ok: true };
  }
  if (isDemoMode()) {
    const { demoTouchStoreDevice } = await import("@/lib/demo/store");
    demoTouchStoreDevice(linked.runtime.deviceId);
    return { ok: true };
  }
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data } = await admin
    .from("store_devices")
    .update({
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", linked.runtime.deviceId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (!data) {
    await clearHubDeviceCookie();
    return { ok: false, reason: "disconnected" };
  }
  return { ok: true };
}

function toView(device: StoreDevice): StoreDeviceView {
  const enabled = !device.revoked_at;
  return {
    id: device.id,
    store_id: device.store_id,
    device_name: device.device_name,
    paired_at: device.paired_at,
    last_seen_at: device.last_seen_at,
    revoked_at: device.revoked_at,
    enabled,
    online: enabled && deviceIsOnline(device.last_seen_at, Date.now(), HUB_DEVICE_ONLINE_MS),
  };
}
