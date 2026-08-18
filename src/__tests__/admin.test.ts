import { describe, expect, it } from "vitest";
import { isSoloAdmin, isSoloAdminEmail, SOLO_ADMIN_EMAIL } from "@/lib/auth/admin";

describe("solo admin lock", () => {
  it("accepts only the designated operator email", () => {
    expect(isSoloAdminEmail(SOLO_ADMIN_EMAIL)).toBe(true);
    expect(isSoloAdminEmail(" stirux.invest@gmail.com ")).toBe(true);
    expect(isSoloAdminEmail("alistira888@gmail.com")).toBe(false);
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
});
