import { createHash, createHmac, randomInt } from "node:crypto";

export const REWARDS_CLAIM_CODE_LENGTH = 12;
export const REWARDS_CLAIM_CODE_TTL_MS = 30 * 24 * 60 * 60_000;
const CLAIM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function normalizeRewardsClaimCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, REWARDS_CLAIM_CODE_LENGTH);
}

export function isValidRewardsClaimCode(code: string): boolean {
  return new RegExp(
    `^[${CLAIM_CODE_ALPHABET}]{${REWARDS_CLAIM_CODE_LENGTH}}$`
  ).test(code);
}

export function generateRewardsClaimCode(): string {
  return Array.from(
    { length: REWARDS_CLAIM_CODE_LENGTH },
    () => CLAIM_CODE_ALPHABET[randomInt(0, CLAIM_CODE_ALPHABET.length)]
  ).join("");
}

export function formatRewardsClaimCode(code: string): string {
  return normalizeRewardsClaimCode(code).replace(/(.{4})(?=.)/g, "$1-");
}

function rewardsClaimPepper(): string {
  return createHash("sha256")
    .update(
      `findit-store-rewards-claim:${process.env.SUPABASE_SERVICE_ROLE_KEY || "demo-claim-pepper"}`
    )
    .digest("hex");
}

export function hashRewardsClaimCode(
  phoneE164: string,
  code: string,
  pepper = rewardsClaimPepper()
): string {
  return createHmac("sha256", pepper)
    .update(`${phoneE164}:${code}`)
    .digest("hex");
}
