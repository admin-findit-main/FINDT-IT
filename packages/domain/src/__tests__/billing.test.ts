import { describe, expect, it } from "vitest";
import {
  BILLING_LAUNCH_CHECKS,
  BILLING_PLANS,
  canApproveLiveBilling,
  inferBillingMethod,
  launchChecklistComplete,
  mapFastSpringSubscriptionState,
  redactPaymentPayload,
  storeOperatingAccess,
  storePlanIdForBilling,
} from "../billing";
import { BUSINESS_PRICE_MONTHLY, PLUS_PRICE_MONTHLY } from "../constants";

describe("billing catalog", () => {
  it("keeps store and shopper prices in one place", () => {
    expect(BILLING_PLANS.business.priceMonthly).toBe(BUSINESS_PRICE_MONTHLY);
    expect(BILLING_PLANS.business.priceMonthly).toBe(99);
    expect(BILLING_PLANS.plus.priceMonthly).toBe(PLUS_PRICE_MONTHLY);
    expect(BILLING_PLANS.plus.priceMonthly).toBe(4.99);
    expect(BILLING_PLANS.business.preferredPaymentMethod).toBe("ACH");
  });

  it("maps existing store plan aliases to the paid business plan", () => {
    expect(storePlanIdForBilling("starter")).toBe("starter");
    expect(storePlanIdForBilling("pro")).toBe("starter");
    expect(storePlanIdForBilling("free")).toBe("free");
  });
});

describe("storeOperatingAccess", () => {
  it("lets every store operate while billing_required is false", () => {
    const deniedStatuses = [
      "expired",
      "canceled",
      "suspended",
      "payment_failed",
    ] as const;
    for (const status of deniedStatuses) {
      expect(
        storeOperatingAccess(
          { status, accessOverride: status === "suspended" ? "suspended" : "none" },
          { ...{ billingRequired: false, allowPastDueAccess: true, allowFailedPaymentAccess: true, allowPendingPaymentAccess: true } }
        ).allowed
      ).toBe(true);
    }
  });

  it("never locks a store for pending ACH when rules allow it", () => {
    const access = storeOperatingAccess(
      { status: "pending_payment", paymentStatus: "processing" },
      {
        billingRequired: true,
        allowPastDueAccess: true,
        allowFailedPaymentAccess: true,
        allowPendingPaymentAccess: true,
      }
    );
    expect(access).toEqual({ allowed: true, reason: "pending_payment" });
  });

  it("keeps complimentary stores open after billing launches", () => {
    expect(
      storeOperatingAccess(
        { status: "expired", accessOverride: "complimentary" },
        {
          billingRequired: true,
          allowPastDueAccess: false,
          allowFailedPaymentAccess: false,
          allowPendingPaymentAccess: true,
        }
      )
    ).toEqual({ allowed: true, reason: "complimentary" });
  });

  it("can lock expired or ended subscriptions after launch", () => {
    expect(
      storeOperatingAccess(
        { status: "expired" },
        {
          billingRequired: true,
          allowPastDueAccess: false,
          allowFailedPaymentAccess: false,
          allowPendingPaymentAccess: true,
        }
      ).allowed
    ).toBe(false);
  });

  it("lets a cancel-at-period-end store finish the paid month", () => {
    const end = new Date(Date.now() + 86400000).toISOString();
    expect(
      storeOperatingAccess(
        { status: "canceled", cancelAtPeriodEnd: true, currentPeriodEnd: end },
        {
          billingRequired: true,
          allowPastDueAccess: false,
          allowFailedPaymentAccess: false,
          allowPendingPaymentAccess: true,
        }
      )
    ).toEqual({ allowed: true, reason: "period_remaining" });
  });
});

describe("FastSpring mapping", () => {
  it("maps subscription states and payment methods", () => {
    expect(mapFastSpringSubscriptionState("trial")).toBe("trial");
    expect(mapFastSpringSubscriptionState("overdue")).toBe("past_due");
    expect(mapFastSpringSubscriptionState("deactivated")).toBe("expired");
    expect(inferBillingMethod("ach")).toBe("ach");
    expect(inferBillingMethod("visa")).toBe("card");
  });

  it("redacts bank and card fields from stored webhook payloads", () => {
    const redacted = redactPaymentPayload({
      accountNumber: "123456789",
      routingNumber: "021000021",
      cardNumber: "4111111111111111",
      cvv: "123",
      last4: "6789",
      nested: { securityCode: "999" },
    }) as Record<string, unknown>;
    expect(redacted.accountNumber).toBe("[redacted]");
    expect(redacted.routingNumber).toBe("[redacted]");
    expect(redacted.cardNumber).toBe("[redacted]");
    expect(redacted.cvv).toBe("[redacted]");
    expect(redacted.last4).toBe("6789");
    expect((redacted.nested as Record<string, unknown>).securityCode).toBe(
      "[redacted]"
    );
  });
});

describe("launch checklist", () => {
  it("blocks live billing until every check is confirmed", () => {
    expect(BILLING_LAUNCH_CHECKS).toHaveLength(20);
    expect(launchChecklistComplete({})).toBe(false);
    const all = Object.fromEntries(
      BILLING_LAUNCH_CHECKS.map((item) => [item.id, true])
    );
    expect(launchChecklistComplete(all)).toBe(true);
    expect(
      canApproveLiveBilling({ checklist: all, liveEnvEnabled: false }).ok
    ).toBe(false);
    expect(
      canApproveLiveBilling({ checklist: all, liveEnvEnabled: true }).ok
    ).toBe(true);
  });
});
