import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { isProductionRuntime } from "@/lib/config/env";

export const JOIN_EMAIL_CODE_TTL_MS = 10 * 60_000;
export const JOIN_EMAIL_CODE_MAX_ATTEMPTS = 5;

export function generateJoinEmailCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function pepper(): string {
  const value =
    process.env.JOIN_EMAIL_CODE_PEPPER ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (value) return value;
  if (isProductionRuntime()) {
    throw new Error(
      "JOIN_EMAIL_CODE_PEPPER or SUPABASE_SERVICE_ROLE_KEY is required in production."
    );
  }
  return "findit-join-email-code";
}

export function hashJoinEmailCode(email: string, code: string): string {
  return createHmac("sha256", pepper())
    .update(`${email.trim().toLowerCase()}:${code}`)
    .digest("hex");
}

export function joinEmailCodesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function normalizeJoinEmailCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}
