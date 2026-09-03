import { createHmac, createHash, randomBytes, randomInt } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function pairingPepper(): string {
  return sha256Hex(
    `findit-hub-pairing:${process.env.SUPABASE_SERVICE_ROLE_KEY || "demo-pepper"}`
  );
}

export function hashPairingCode(code: string, pepper = pairingPepper()): string {
  return createHmac("sha256", pepper).update(code).digest("hex");
}

export function generateHubPin(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

export function generatePairingCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export {
  formatPairingCode,
  normalizePairingCode,
  deviceIsOnline,
} from "./format";

export function serializeDeviceCookie(deviceId: string, token: string): string {
  return `v1.${deviceId}.${token}`;
}

export function parseDeviceCookie(
  value: string | undefined | null
): { deviceId: string; token: string } | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const deviceId = parts[1];
  const token = parts[2];
  if (!/^[0-9a-f-]{36}$/i.test(deviceId) || !/^[0-9a-f]{64}$/i.test(token)) {
    return null;
  }
  return { deviceId, token };
}

export function serializeShiftCookie(punchId: string): string {
  return `v1.${punchId}`;
}

export function parseShiftCookie(
  value: string | undefined | null
): { punchId: string } | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2 || parts[0] !== "v1") return null;
  const punchId = parts[1];
  if (!/^[0-9a-f-]{36}$/i.test(punchId)) return null;
  return { punchId };
}

export function serializePairingCookie(pairingId: string, secret: string): string {
  return `v1.${pairingId}.${secret}`;
}

export function parsePairingCookie(
  value: string | undefined | null
): { pairingId: string; secret: string } | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const pairingId = parts[1];
  const secret = parts[2];
  if (!/^[0-9a-f-]{36}$/i.test(pairingId) || !/^[0-9a-f]{64}$/i.test(secret)) {
    return null;
  }
  return { pairingId, secret };
}
