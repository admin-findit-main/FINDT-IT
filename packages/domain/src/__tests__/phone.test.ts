import { describe, expect, it } from "vitest";
import {
  accountContactLabel,
  CUSTOMER_SIGNUP_PHONE_CONFLICT_MESSAGE,
  customerNeedsFirstName,
  formatUsNationalInput,
  isCustomerSignupPhoneConflict,
  mapPhoneOtpError,
  maskPhoneE164,
  normalizeCustomerSignupIdentity,
  normalizePhoneToE164,
} from "../phone";

describe("normalizePhoneToE164", () => {
  it("normalizes US formats to E.164", () => {
    expect(normalizePhoneToE164("(703) 555-1234")).toEqual({
      ok: true,
      e164: "+17035551234",
    });
    expect(normalizePhoneToE164("7035551234")).toEqual({
      ok: true,
      e164: "+17035551234",
    });
    expect(normalizePhoneToE164("1 703 555 1234")).toEqual({
      ok: true,
      e164: "+17035551234",
    });
    expect(normalizePhoneToE164("+17035551234")).toEqual({
      ok: true,
      e164: "+17035551234",
    });
  });

  it("rejects incomplete or empty numbers", () => {
    expect(normalizePhoneToE164("")).toMatchObject({ ok: false });
    expect(normalizePhoneToE164("555")).toMatchObject({ ok: false });
    expect(normalizePhoneToE164("abc")).toMatchObject({ ok: false });
  });
});

describe("maskPhoneE164", () => {
  it("hides all but last four US digits", () => {
    expect(maskPhoneE164("+17035551234")).toBe("+1••••1234");
  });
});

describe("formatUsNationalInput", () => {
  it("formats as the user types", () => {
    expect(formatUsNationalInput("703")).toBe("(703");
    expect(formatUsNationalInput("703555")).toBe("(703) 555");
    expect(formatUsNationalInput("7035551234")).toBe("(703) 555-1234");
  });
});

describe("customer signup identity", () => {
  it("trims the name and normalizes the required US phone", () => {
    expect(normalizeCustomerSignupIdentity("  Jordan  ", "(703) 555-1234")).toEqual({
      ok: true,
      identity: {
        firstName: "Jordan",
        displayName: "Jordan",
        phoneE164: "+17035551234",
      },
    });
  });

  it("rejects missing identity fields and recognizes phone collisions", () => {
    expect(normalizeCustomerSignupIdentity("", "7035551234")).toMatchObject({
      ok: false,
    });
    expect(normalizeCustomerSignupIdentity("Jordan", "555")).toMatchObject({
      ok: false,
    });
    expect(
      isCustomerSignupPhoneConflict(
        'duplicate key value violates unique constraint "profiles_phone_e164_key"'
      )
    ).toBe(true);
    expect(CUSTOMER_SIGNUP_PHONE_CONFLICT_MESSAGE).not.toMatch(
      /connected to another|already registered/i
    );
  });
});

describe("customerNeedsFirstName", () => {
  it("asks customers with a blank name only", () => {
    expect(
      customerNeedsFirstName({ first_name: "", account_type: "customer" })
    ).toBe(true);
    expect(
      customerNeedsFirstName({ first_name: "Jordan", account_type: "customer" })
    ).toBe(false);
    expect(
      customerNeedsFirstName({ first_name: "", account_type: "business" })
    ).toBe(false);
  });
});

describe("accountContactLabel", () => {
  it("prefers email and masks phone", () => {
    expect(accountContactLabel({ email: "a@b.co", phone_e164: "+17035551234" })).toBe(
      "a@b.co"
    );
    expect(accountContactLabel({ email: null, phone_e164: "+17035551234" })).toBe(
      "+1••••1234"
    );
  });
});

describe("mapPhoneOtpError", () => {
  it("maps expired and invalid codes", () => {
    expect(mapPhoneOtpError("Token has expired or is invalid", "verify")).toMatch(
      /expired|incorrect/i
    );
    expect(mapPhoneOtpError("Failed to fetch", "send")).toMatch(/connection/i);
    expect(mapPhoneOtpError("Signups not allowed for otp", "send")).toMatch(/Sign up/i);
    expect(mapPhoneOtpError("Unsupported phone provider", "send")).toMatch(/Twilio/i);
    expect(mapPhoneOtpError("400: phone_provider_disabled", "send")).toMatch(/Twilio/i);
  });
});
