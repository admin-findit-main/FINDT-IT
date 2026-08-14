import { describe, expect, it } from "vitest";
import { isSafeNextPath, resolveAppHome } from "@/lib/auth/home-path";

describe("resolveAppHome", () => {
  it("sends admins to /admin", () => {
    expect(
      resolveAppHome({ accountType: "admin", hasActiveStoreMembership: false })
    ).toBe("/admin");
  });

  it("sends business accounts to /store", () => {
    expect(
      resolveAppHome({ accountType: "business", hasActiveStoreMembership: false })
    ).toBe("/store");
  });

  it("sends store members to /store even if account_type is customer", () => {
    expect(
      resolveAppHome({ accountType: "customer", hasActiveStoreMembership: true })
    ).toBe("/store");
  });

  it("sends customers to /home", () => {
    expect(
      resolveAppHome({ accountType: "customer", hasActiveStoreMembership: false })
    ).toBe("/home");
  });
});

describe("isSafeNextPath", () => {
  it("allows relative app paths", () => {
    expect(isSafeNextPath("/store")).toBe(true);
    expect(isSafeNextPath("/home")).toBe(true);
  });

  it("rejects open redirects", () => {
    expect(isSafeNextPath("//evil.com")).toBe(false);
    expect(isSafeNextPath("https://evil.com")).toBe(false);
    expect(isSafeNextPath(null)).toBe(false);
  });
});
