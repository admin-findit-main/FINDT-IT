import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_CONFIRMATION,
  accountDeletionBlockReason,
  isAccountDeletionConfirmed,
} from "../account-deletion";
import { SUPPORT_EMAIL } from "../admin";

describe("account deletion", () => {
  it("requires typing DELETE", () => {
    expect(isAccountDeletionConfirmed("DELETE")).toBe(true);
    expect(isAccountDeletionConfirmed(" delete ")).toBe(true);
    expect(isAccountDeletionConfirmed("delete account")).toBe(false);
    expect(ACCOUNT_DELETION_CONFIRMATION).toBe("DELETE");
  });

  it("blocks the operator and store owners", () => {
    expect(
      accountDeletionBlockReason({ isOperator: true, ownedStoreNames: [] })
    ).toMatch(/operator/i);
    expect(
      accountDeletionBlockReason({
        isOperator: false,
        ownedStoreNames: ["Main Street Market"],
      })
    ).toContain("Main Street Market");
    expect(
      accountDeletionBlockReason({
        isOperator: false,
        ownedStoreNames: ["A", "B"],
      })
    ).toContain(SUPPORT_EMAIL);
  });

  it("allows shoppers and store staff who do not own a store", () => {
    expect(
      accountDeletionBlockReason({ isOperator: false, ownedStoreNames: [] })
    ).toBeNull();
  });
});
