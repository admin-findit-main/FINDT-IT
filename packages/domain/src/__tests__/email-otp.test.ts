import { describe, expect, it } from "vitest";
import { mapEmailOtpError, maskEmail, normalizeEmail } from "../email-otp";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  A@B.COM ")).toEqual({ ok: true, email: "a@b.com" });
  });

  it("rejects empty or malformed addresses", () => {
    expect(normalizeEmail("")).toMatchObject({ ok: false });
    expect(normalizeEmail("not-an-email")).toMatchObject({ ok: false });
  });
});

describe("maskEmail", () => {
  it("hides the local part after the first character", () => {
    expect(maskEmail("shopper@askfindit.com")).toBe("s•••@askfindit.com");
  });
});

describe("mapEmailOtpError", () => {
  it("maps expired codes and missing accounts", () => {
    expect(mapEmailOtpError("Token has expired or is invalid", "verify")).toMatch(
      /expired|incorrect/i
    );
    expect(mapEmailOtpError("Signups not allowed for otp", "send")).toMatch(/Sign up/i);
    expect(mapEmailOtpError("context deadline exceeded", "send")).toMatch(/timed out/i);
  });
});
