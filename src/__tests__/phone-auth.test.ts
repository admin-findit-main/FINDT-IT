import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_PHONE_OTP,
  DEMO_EMAIL_OTP,
  maskEmail,
  maskPhoneE164,
  normalizeEmail,
  normalizePhoneToE164,
} from "@findit/domain";
import {
  demoSendEmailOtp,
  demoSendPhoneOtp,
  demoVerifyEmailOtp,
  demoVerifyPhoneOtp,
  resetDemoState,
} from "@/lib/demo/store";

beforeEach(() => {
  resetDemoState();
});

describe("customer phone auth", () => {
  it("stores numbers in E.164 and masks them for display", () => {
    const parsed = normalizePhoneToE164("(703) 555-1234");
    expect(parsed).toEqual({ ok: true, e164: "+17035551234" });
    if (parsed.ok) expect(maskPhoneE164(parsed.e164)).toBe("+1••••1234");
  });

  it("creates a customer on signup OTP and asks for a first name", () => {
    demoSendPhoneOtp("+17035551234");
    const result = demoVerifyPhoneOtp("+17035551234", DEMO_PHONE_OTP, true);
    expect(result.profile.phone_e164).toBe("+17035551234");
    expect(result.profile.email).toBeNull();
    expect(result.needsName).toBe(true);
  });

  it("rejects login OTP when no account exists", () => {
    expect(() =>
      demoVerifyPhoneOtp("+17035559999", DEMO_PHONE_OTP, false)
    ).toThrow(/Sign up/i);
  });

  it("rejects a wrong code", () => {
    demoSendPhoneOtp("+17035551234");
    expect(() => demoVerifyPhoneOtp("+17035551234", "000000", true)).toThrow(
      /incorrect/i
    );
  });

  it("lets a store owner sign in with the number on their account", () => {
    demoSendPhoneOtp("+17035550198");
    const result = demoVerifyPhoneOtp("+17035550198", DEMO_PHONE_OTP, false, "store");
    expect(result.profile.account_type).toBe("business");
    expect(result.needsName).toBe(false);
  });

  it("keeps a shopper phone off the store login", () => {
    demoSendPhoneOtp("+17035551234");
    demoVerifyPhoneOtp("+17035551234", DEMO_PHONE_OTP, true);
    expect(() =>
      demoVerifyPhoneOtp("+17035551234", DEMO_PHONE_OTP, false, "store")
    ).toThrow(/Shopper sign in/);
  });
});

describe("customer email auth", () => {
  it("normalizes and masks email", () => {
    expect(normalizeEmail("  Jordan@Demo.Findit.local ")).toEqual({
      ok: true,
      email: "jordan@demo.findit.local",
    });
    expect(maskEmail("customer@demo.findit.local")).toBe("c•••@demo.findit.local");
  });

  it("creates a customer on signup OTP and asks for a first name", () => {
    demoSendEmailOtp("newshopper@demo.findit.local");
    const result = demoVerifyEmailOtp(
      "newshopper@demo.findit.local",
      DEMO_EMAIL_OTP,
      true
    );
    expect(result.profile.email).toBe("newshopper@demo.findit.local");
    expect(result.needsName).toBe(true);
  });

  it("lets an existing shopper sign in with email", () => {
    demoSendEmailOtp("customer@demo.findit.local");
    const result = demoVerifyEmailOtp(
      "customer@demo.findit.local",
      DEMO_EMAIL_OTP,
      false
    );
    expect(result.profile.first_name).toBe("Jordan");
    expect(result.needsName).toBe(false);
  });

  it("rejects login OTP when no account exists", () => {
    expect(() =>
      demoVerifyEmailOtp("nobody@demo.findit.local", DEMO_EMAIL_OTP, false)
    ).toThrow(/Sign up/i);
  });

  it("keeps a store owner off the shopper email login", () => {
    demoSendEmailOtp("owner@demo.findit.local");
    expect(() =>
      demoVerifyEmailOtp("owner@demo.findit.local", DEMO_EMAIL_OTP, false, "shopper")
    ).toThrow(/Store sign in/);
  });
});
