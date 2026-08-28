import { describe, expect, it } from "vitest";
import { passwordRejectReason, passwordStrength } from "../password";

describe("password strength", () => {
  it("rejects short and common passwords", () => {
    expect(passwordStrength("abc").ok).toBe(false);
    expect(passwordStrength("password").ok).toBe(false);
    expect(passwordStrength("12345678").ok).toBe(false);
    expect(passwordRejectReason("password")).toMatch(/common/i);
  });

  it("accepts a long mixed password", () => {
    const result = passwordStrength("Riverstone-49");
    expect(result.ok).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it("accepts eight characters plus a number used in join tests", () => {
    const result = passwordStrength("storepass9");
    expect(result.ok).toBe(true);
    expect(result.label).toMatch(/Fair|Good|Strong/);
  });

  it("penalizes using the email local part", () => {
    const result = passwordStrength("caseyowner99", "caseyowner@example.com");
    expect(result.ok).toBe(false);
  });
});
