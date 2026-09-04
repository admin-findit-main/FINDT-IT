import { createHmac } from "node:crypto";
import { pairingPepper, sha256Hex } from "@/lib/hub/crypto";

export const CHECKIN_TOKEN_TTL_MS = 90_000;
export const CHECKIN_ROTATE_MS = 45_000;

export function hashCheckinSecret(secret: string, pepper = pairingPepper()): string {
  return createHmac("sha256", pepper).update(`checkin:${secret}`).digest("hex");
}

export function hashCheckinToken(token: string): string {
  return sha256Hex(`findit-checkin:${token}`);
}
