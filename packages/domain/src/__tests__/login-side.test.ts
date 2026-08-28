import { describe, expect, it } from "vitest";
import { loginAudienceForAccount, wrongLoginSideMessage } from "../login-side";

describe("loginAudienceForAccount", () => {
  it("sends shoppers to the shopper screen", () => {
    expect(
      loginAudienceForAccount({ accountType: "customer", hasActiveStoreMembership: false })
    ).toBe("shopper");
  });

  it("sends store owners, staff, and the operator to the store screen", () => {
    expect(loginAudienceForAccount({ accountType: "business" })).toBe("store");
    expect(
      loginAudienceForAccount({
        accountType: "customer",
        hasActiveStoreMembership: true,
      })
    ).toBe("store");
    expect(loginAudienceForAccount({ isAdmin: true, accountType: "admin" })).toBe(
      "store"
    );
  });
});

describe("wrongLoginSideMessage", () => {
  it("tells a store email to use Store sign in", () => {
    expect(wrongLoginSideMessage("store")).toMatch(/Store sign in/);
  });

  it("tells a shopper email to use Shopper sign in", () => {
    expect(wrongLoginSideMessage("shopper")).toMatch(/Shopper sign in/);
  });
});
