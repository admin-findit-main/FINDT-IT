import { describe, expect, it } from "vitest";
import {
  customerReplyAlertCopy,
  customerReplyPushCopy,
  shouldNotifyCustomerOfReply,
} from "../notify";

describe("shouldNotifyCustomerOfReply", () => {
  it("defaults to on when prefs are unset", () => {
    expect(shouldNotifyCustomerOfReply("in_stock", {})).toBe(true);
    expect(shouldNotifyCustomerOfReply("can_order", {})).toBe(true);
  });

  it("honors off switches", () => {
    expect(
      shouldNotifyCustomerOfReply("in_stock", { notify_in_stock: false })
    ).toBe(false);
    expect(
      shouldNotifyCustomerOfReply("can_order", { notify_can_order: false })
    ).toBe(false);
  });

  it("does not alert on out of stock", () => {
    expect(shouldNotifyCustomerOfReply("out_of_stock", {})).toBe(false);
  });
});

describe("reply copy", () => {
  it("names the store in the in-app alert", () => {
    expect(
      customerReplyAlertCopy({
        responseType: "in_stock",
        storeName: "FINDIT Test Market",
        productName: "Oat milk",
      })
    ).toEqual({
      title: "FINDIT Test Market has it in stock",
      body: "Oat milk",
    });
  });

  it("keeps the phone push short", () => {
    expect(
      customerReplyPushCopy({
        responseType: "can_order",
        productName: "Oat milk",
      })
    ).toEqual({
      title: "A store can order it",
      body: "Oat milk",
    });
  });
});
