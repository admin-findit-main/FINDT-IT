import { beforeEach, describe, expect, it } from "vitest";
import {
  demoClaimHubPairing,
  demoCreateHubPairing,
  demoGetStoreDeviceBySession,
  demoListStoreDevices,
  demoLogin,
  demoRedeemHubPairing,
  demoRevokeStoreDevice,
  demoSetStoreDeviceEnabled,
  getDemoState,
  resetDemoState,
} from "@/lib/demo/store";
import {
  formatPairingCode,
  hashPairingCode,
  normalizePairingCode,
  parseDeviceCookie,
  serializeDeviceCookie,
  sha256Hex,
} from "@/lib/hub/crypto";

beforeEach(() => {
  resetDemoState();
  process.env.FINDIT_DEMO_MODE = "true";
});

describe("hub pairing codes", () => {
  it("formats and normalizes 6-digit codes", () => {
    expect(normalizePairingCode("482 731")).toBe("482731");
    expect(normalizePairingCode("12")).toBeNull();
    expect(formatPairingCode("482731")).toBe("482 731");
  });

  it("hashes codes instead of storing them", () => {
    const a = hashPairingCode("482731");
    const b = hashPairingCode("482731");
    expect(a).toBe(b);
    expect(a).not.toContain("482731");
    expect(a).toHaveLength(64);
  });
});

describe("FINDIT Hub device pairing", () => {
  it("lets an owner claim a code and the waiting device redeem a session", () => {
    const owner = demoLogin("owner@demo.findit.local", "demo1234")!;
    const store = getDemoState().stores.find((s) => s.owner_id === owner.id)!;
    const pairing = demoCreateHubPairing();
    expect(pairing.code).toMatch(/^\d{6}$/);

    const claimed = demoClaimHubPairing({
      code: pairing.code,
      storeId: store.id,
      deviceName: "Front Counter iPad",
      pairedBy: owner.id,
    });
    expect("device" in claimed).toBe(true);
    if ("error" in claimed) throw new Error(claimed.error);

    const reused = demoClaimHubPairing({
      code: pairing.code,
      storeId: store.id,
      deviceName: "Other",
      pairedBy: owner.id,
    });
    expect("error" in reused).toBe(true);

    const redeemed = demoRedeemHubPairing({
      pairingId: pairing.pairingId,
      secret: pairing.secret,
    });
    expect("token" in redeemed).toBe(true);
    if ("error" in redeemed) throw new Error(redeemed.error);

    const device = demoGetStoreDeviceBySession(redeemed.deviceId, redeemed.token);
    expect(device?.device_name).toBe("Front Counter iPad");
    expect(device?.store_id).toBe(store.id);

    const secondRedeem = demoRedeemHubPairing({
      pairingId: pairing.pairingId,
      secret: pairing.secret,
    });
    expect("error" in secondRedeem).toBe(true);
    if ("error" in secondRedeem) {
      expect(secondRedeem.error).toMatch(/already used/i);
    }

    const listed = demoListStoreDevices(store.id);
    expect(listed.some((d) => d.id === redeemed.deviceId && !d.revoked_at)).toBe(true);
  });

  it("rejects expired codes, wrong secrets, and revoked devices", () => {
    const owner = demoLogin("owner@demo.findit.local", "demo1234")!;
    const store = getDemoState().stores.find((s) => s.owner_id === owner.id)!;
    const pairing = demoCreateHubPairing();
    const row = getDemoState().devicePairings.find((p) => p.id === pairing.pairingId)!;
    row.expires_at = new Date(Date.now() - 1000).toISOString();

    const expired = demoClaimHubPairing({
      code: pairing.code,
      storeId: store.id,
      deviceName: "Old tablet",
      pairedBy: owner.id,
    });
    expect("error" in expired).toBe(true);

    const fresh = demoCreateHubPairing();
    const wrong = demoRedeemHubPairing({
      pairingId: fresh.pairingId,
      secret: "0".repeat(64),
    });
    expect("error" in wrong).toBe(true);

    const claimed = demoClaimHubPairing({
      code: fresh.code,
      storeId: store.id,
      deviceName: "Register Tablet",
      pairedBy: owner.id,
    });
    if ("error" in claimed) throw new Error(claimed.error);
    const redeemed = demoRedeemHubPairing({
      pairingId: fresh.pairingId,
      secret: fresh.secret,
    });
    if ("error" in redeemed) throw new Error(redeemed.error);

    demoRevokeStoreDevice(store.id, redeemed.deviceId);
    expect(demoGetStoreDeviceBySession(redeemed.deviceId, redeemed.token)).toBeNull();

    const restored = demoSetStoreDeviceEnabled(store.id, redeemed.deviceId, true);
    expect("error" in restored).toBe(false);
    expect(demoGetStoreDeviceBySession(redeemed.deviceId, redeemed.token)?.id).toBe(
      redeemed.deviceId
    );
  });

  it("serializes a device cookie without storing the raw token in the listing", () => {
    const token = "a".repeat(64);
    const deviceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const cookie = serializeDeviceCookie(deviceId, token);
    expect(parseDeviceCookie(cookie)).toEqual({ deviceId, token });
    expect(sha256Hex(token)).not.toBe(token);
  });
});
