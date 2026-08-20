import { describe, expect, it } from "vitest";
import {
  coerceSoloAdminProfile,
  isShopperAccount,
  isSoloAdmin,
  isSoloAdminEmail,
  SOLO_ADMIN_EMAIL,
} from "@/lib/auth/admin";

describe("solo admin lock", () => {
  it("accepts only the designated operator email", () => {
    expect(isSoloAdminEmail(SOLO_ADMIN_EMAIL)).toBe(true);
    expect(isSoloAdminEmail(" admin.findit@gmail.com ")).toBe(true);
    expect(isSoloAdminEmail("stirux.invest@gmail.com")).toBe(false);
    expect(isSoloAdminEmail(null)).toBe(false);
  });

  it("requires both admin role and the designated email", () => {
    expect(
      isSoloAdmin({ email: SOLO_ADMIN_EMAIL, account_type: "admin" })
    ).toBe(true);
    expect(
      isSoloAdmin({ email: "alistira888@gmail.com", account_type: "admin" })
    ).toBe(false);
    expect(
      isSoloAdmin({ email: SOLO_ADMIN_EMAIL, account_type: "business" })
    ).toBe(false);
  });

  it("promotes the operator email even if the profile row says customer", () => {
    expect(
      coerceSoloAdminProfile(
        { email: SOLO_ADMIN_EMAIL, account_type: "customer" },
        SOLO_ADMIN_EMAIL
      )
    ).toEqual({ email: SOLO_ADMIN_EMAIL, account_type: "admin" });
    expect(
      coerceSoloAdminProfile(
        { email: null, account_type: "customer" },
        SOLO_ADMIN_EMAIL
      )
    ).toEqual({ email: SOLO_ADMIN_EMAIL, account_type: "admin" });
    expect(
      coerceSoloAdminProfile(
        { email: "alistira888@gmail.com", account_type: "admin" },
        "alistira888@gmail.com"
      )
    ).toEqual({ email: "alistira888@gmail.com", account_type: "customer" });
  });

  it("never treats the operator email as a shopper", () => {
    expect(
      isShopperAccount({ email: SOLO_ADMIN_EMAIL, account_type: "customer" })
    ).toBe(false);
    expect(
      isShopperAccount({ email: "shopper@test.com", account_type: "customer" })
    ).toBe(true);
  });
});
