import { describe, expect, it } from "vitest";
import {
  REWARDS_CLAIM_CODE_LENGTH,
  formatRewardsClaimCode,
  generateRewardsClaimCode,
  hashRewardsClaimCode,
  isValidRewardsClaimCode,
  normalizeRewardsClaimCode,
} from "@/lib/loyalty/claim-code";

describe("store rewards claim codes", () => {
  it("normalizes and formats pasted recovery codes", () => {
    expect(normalizeRewardsClaimCode("abcd-2345-wxyz")).toBe("ABCD2345WXYZ");
    expect(formatRewardsClaimCode("ABCD2345WXYZ")).toBe("ABCD-2345-WXYZ");
    expect(isValidRewardsClaimCode("ABCD2345WXYZ")).toBe(true);
    expect(isValidRewardsClaimCode("ABCD2345WXY")).toBe(false);
    expect(isValidRewardsClaimCode("ABCD2345WXYO")).toBe(false);
  });

  it("generates fixed-length unambiguous codes", () => {
    const code = generateRewardsClaimCode();
    expect(code).toHaveLength(REWARDS_CLAIM_CODE_LENGTH);
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$/);
  });

  it("binds the HMAC to both phone and code", () => {
    const pepper = "test-pepper";
    const hash = hashRewardsClaimCode("+17035550100", "ABCD2345WXYZ", pepper);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(
      hashRewardsClaimCode("+17035550101", "ABCD2345WXYZ", pepper)
    );
    expect(hash).not.toBe(
      hashRewardsClaimCode("+17035550100", "ABCD2345WXY2", pepper)
    );
  });
});
