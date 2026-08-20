import { describe, expect, it } from "vitest";
import {
  destinationAfterAuth,
  destinationAfterEmailLink,
  isCustomerSurfacePath,
  isSafeNextPath,
  resolveAppHome,
  resolvePostAuthDestination,
} from "@/lib/auth/home-path";
import { SOLO_ADMIN_EMAIL } from "@/lib/auth/admin";

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

describe("resolvePostAuthDestination", () => {
  it("sends the operator to /admin even when next is a customer path", () => {
    expect(
      resolvePostAuthDestination({
        profile: { email: SOLO_ADMIN_EMAIL, account_type: "customer" },
        authEmail: SOLO_ADMIN_EMAIL,
        next: "/home",
      })
    ).toBe("/admin");
  });

  it("uses auth email when the profile row is missing", () => {
    expect(
      resolvePostAuthDestination({
        profile: null,
        authEmail: SOLO_ADMIN_EMAIL,
        next: "/requests",
      })
    ).toBe("/admin");
  });

  it("keeps password-update for the operator", () => {
    expect(
      resolvePostAuthDestination({
        profile: { email: SOLO_ADMIN_EMAIL, account_type: "admin" },
        authEmail: SOLO_ADMIN_EMAIL,
        next: "/auth/update-password",
      })
    ).toBe("/auth/update-password");
  });

  it("keeps password-update for customers", () => {
    expect(
      resolvePostAuthDestination({
        profile: { email: "shopper@test.com", account_type: "customer" },
        next: "/auth/update-password",
      })
    ).toBe("/auth/update-password");
  });

  it("does not let a customer next steal a store home", () => {
    expect(
      resolvePostAuthDestination({
        profile: { email: "owner@store.test", account_type: "business" },
        next: "/home",
      })
    ).toBe("/store");
  });

  it("honors invite next for store staff", () => {
    expect(
      resolvePostAuthDestination({
        profile: { email: "staff@store.test", account_type: "customer" },
        hasActiveStoreMembership: true,
        next: "/invite/abc",
      })
    ).toBe("/invite/abc");
  });
});

describe("destinationAfterAuth", () => {
  it("sends the operator email to /admin even if homePath is /home", () => {
    expect(
      destinationAfterAuth({
        homePath: "/home",
        next: "/home",
        email: SOLO_ADMIN_EMAIL,
      })
    ).toBe("/admin");
  });

  it("sends customers to welcome when they still need a name", () => {
    expect(
      destinationAfterAuth({ homePath: "/home", needsName: true, next: "/requests" })
    ).toBe("/welcome");
  });

  it("keeps password-update even for the operator email helper", () => {
    expect(
      destinationAfterAuth({
        homePath: "/admin",
        next: "/auth/update-password",
        email: SOLO_ADMIN_EMAIL,
      })
    ).toBe("/auth/update-password");
  });
});

describe("destinationAfterEmailLink", () => {
  it("sends recovery links to the password form", () => {
    expect(
      destinationAfterEmailLink({
        type: "recovery",
        email: "shopper@test.com",
        homePath: "/home",
      })
    ).toBe("/auth/update-password");
  });

  it("signs confirmed customers into their home", () => {
    expect(
      destinationAfterEmailLink({
        type: "email",
        email: "shopper@test.com",
        homePath: "/home",
      })
    ).toBe("/home");
  });

  it("signs the operator in after confirming email", () => {
    expect(
      destinationAfterEmailLink({
        type: "email",
        email: SOLO_ADMIN_EMAIL,
        homePath: "/home",
      })
    ).toBe("/admin");
  });
});

describe("isCustomerSurfacePath", () => {
  it("flags shopper routes", () => {
    expect(isCustomerSurfacePath("/home")).toBe(true);
    expect(isCustomerSurfacePath("/requests/1")).toBe(true);
    expect(isCustomerSurfacePath("/admin")).toBe(false);
    expect(isCustomerSurfacePath("/store")).toBe(false);
  });
});
