import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyFastSpringSignature } from "@/lib/billing/fastspring";
import { normalizeFastSpringEvent } from "@/lib/billing/webhooks";

describe("FastSpring webhook signatures", () => {
  it("accepts the official HMAC SHA256 base64 of the raw body", () => {
    const secret = "findit-test-webhook";
    const body = '{"events":[{"id":"evt_1","type":"order.completed"}]}';
    const signature = createHmac("sha256", secret).update(body).digest("base64");
    expect(verifyFastSpringSignature(body, signature, secret)).toBe(true);
    expect(verifyFastSpringSignature(body, "nope", secret)).toBe(false);
    expect(verifyFastSpringSignature(body, signature, "other")).toBe(false);
    expect(verifyFastSpringSignature(body, null, secret)).toBe(false);
  });
});

describe("normalizeFastSpringEvent", () => {
  it("maps ACH pending and does not treat it as a paid activation", () => {
    const event = normalizeFastSpringEvent({
      id: "evt_pending",
      type: "order.payment.pending",
      live: false,
      data: {
        order: "ord_1",
        tags: { findit_audience: "store", findit_store_id: "store-1" },
        payment: { type: "ach" },
      },
    });
    expect(event?.status).toBe("pending_payment");
    expect(event?.paymentStatus).toBe("processing");
    expect(event?.billingMethod).toBe("ach");
    expect(event?.storeId).toBe("store-1");
  });

  it("maps successful ACH and failed/returned debits", () => {
    expect(
      normalizeFastSpringEvent({
        id: "evt_ok",
        type: "order.completed",
        data: { order: "ord_2", tags: { findit_audience: "store" } },
      })?.status
    ).toBe("active");
    expect(
      normalizeFastSpringEvent({
        id: "evt_fail",
        type: "order.failed",
        data: { order: "ord_3" },
      })?.paymentStatus
    ).toBe("failed");
    expect(
      normalizeFastSpringEvent({
        id: "evt_return",
        type: "order.canceled",
        data: { order: "ord_4" },
      })?.paymentStatus
    ).toBe("returned");
    expect(
      normalizeFastSpringEvent({
        id: "evt_refund",
        type: "return.created",
        data: { order: "ord_5" },
      })?.paymentStatus
    ).toBe("refunded");
  });

  it("keeps shopper events off the store path", () => {
    const event = normalizeFastSpringEvent({
      id: "evt_plus",
      type: "subscription.activated",
      data: {
        subscription: "sub_plus",
        state: "active",
        tags: { findit_audience: "customer", findit_profile_id: "user-1" },
      },
    });
    expect(event?.audience).toBe("customer");
    expect(event?.profileId).toBe("user-1");
    expect(event?.storeId).toBeNull();
  });
});
