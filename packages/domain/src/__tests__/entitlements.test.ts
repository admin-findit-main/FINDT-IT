import { describe, expect, it } from "vitest";
import {
  FREE_MONTHLY_REQUEST_LIMIT,
  PLUS_MONTHLY_REQUEST_LIMIT,
  STORE_TRIAL_DAYS,
  BUSINESS_PRICE_MONTHLY,
  CUSTOMER_PLANS,
  STORE_PLANS,
} from "../constants";
import {
  countsTowardMonthlyFindCap,
  createdInMonthlyFindWindow,
  customerPlanCatalog,
  customerPlanPriceLabel,
  getConsumerEntitlements,
  isMonthlyFindCapError,
  planLimitReachedMessage,
  radiusOptionsForPlan,
} from "../entitlements";

describe("product architecture config", () => {
  it("gives free customers 5 Finds per month", () => {
    expect(FREE_MONTHLY_REQUEST_LIMIT).toBe(5);
    expect(CUSTOMER_PLANS.free.monthlyRequests).toBe(5);
  });

  it("caps FINDIT+ instead of unlimited", () => {
    expect(PLUS_MONTHLY_REQUEST_LIMIT).toBeGreaterThan(FREE_MONTHLY_REQUEST_LIMIT);
    expect(CUSTOMER_PLANS.plus.monthlyRequests).toBe(PLUS_MONTHLY_REQUEST_LIMIT);
  });

  it("prices FINDIT+ at $4.99/month from one constant", () => {
    expect(CUSTOMER_PLANS.plus.priceMonthly).toBe(4.99);
  });

  it("models FINDIT+ Business as $99/month with every store feature", () => {
    expect(STORE_TRIAL_DAYS).toBe(30);
    expect(BUSINESS_PRICE_MONTHLY).toBe(99);
    expect(STORE_PLANS.starter.priceMonthly).toBe(99);
    expect(STORE_PLANS.pro.priceMonthly).toBe(99);
  });
});

describe("getConsumerEntitlements", () => {
  it("treats FINDIT+ as a plan, not a role", () => {
    const free = getConsumerEntitlements("free");
    const plus = getConsumerEntitlements("plus");
    expect(free.planId).toBe("free");
    expect(free.canExpandSearch).toBe(false);
    expect(free.canSaveProducts).toBe(false);
    expect(plus.planId).toBe("plus");
    expect(plus.canExpandSearch).toBe(true);
    expect(plus.canSaveProducts).toBe(true);
    expect(plus.canUseProductWatch).toBe(false);
    expect(plus.maxSearchRadiusMiles).toBeGreaterThan(free.maxSearchRadiusMiles);
  });

  it("defaults unknown plans to free", () => {
    expect(getConsumerEntitlements("gold").planId).toBe("free");
    expect(getConsumerEntitlements(null).monthlyRequestLimit).toBe(5);
  });

  it("explains the free cap without hiding results", () => {
    expect(planLimitReachedMessage(getConsumerEntitlements("free"))).toMatch(
      /5 free Finds/i
    );
  });

  it("hides radius options beyond the plan cap", () => {
    const free = radiusOptionsForPlan(
      getConsumerEntitlements("free").maxSearchRadiusMiles
    );
    const plus = radiusOptionsForPlan(
      getConsumerEntitlements("plus").maxSearchRadiusMiles
    );
    expect(free.map((o) => o.miles)).toEqual([2, 5, 10]);
    expect(plus.map((o) => o.miles)).toEqual([2, 5, 10, 15, 25, 40]);
  });

  it("does not refund a Find when the request is later cancelled", () => {
    expect(countsTowardMonthlyFindCap("cancelled")).toBe(true);
    expect(countsTowardMonthlyFindCap("expired")).toBe(true);
    expect(countsTowardMonthlyFindCap("fulfilled")).toBe(true);
    expect(countsTowardMonthlyFindCap("active")).toBe(true);
  });

  it("counts this month’s created Finds, not last month", () => {
    expect(createdInMonthlyFindWindow(new Date().toISOString())).toBe(true);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    expect(createdInMonthlyFindWindow(lastMonth.toISOString())).toBe(false);
  });

  it("recognizes monthly cap errors from server and database copy", () => {
    expect(
      isMonthlyFindCapError("You've used your 5 free Finds this month.")
    ).toBe(true);
    expect(
      isMonthlyFindCapError("FINDIT+ includes 25 Finds per month.")
    ).toBe(true);
    expect(isMonthlyFindCapError("Couldn't create your request.")).toBe(false);
  });

  it("shows the FINDIT+ price but keeps purchase gated", () => {
    expect(customerPlanPriceLabel("free")).toBe("Free");
    expect(customerPlanPriceLabel("plus")).toBe("$4.99 / month");
    const catalog = customerPlanCatalog();
    expect(catalog.billingLive).toBe(false);
    expect(catalog.plans.map((p) => p.id)).toEqual(["free", "plus"]);
    expect(catalog.plans[1].pros.some((p) => /25 Finds/i.test(p))).toBe(true);
    expect(catalog.plans[1].cons.some((c) => /cannot be purchased/i.test(c))).toBe(
      true
    );
    expect(catalog.business.priceLabel).toMatch(/\$99/);
  });
});
