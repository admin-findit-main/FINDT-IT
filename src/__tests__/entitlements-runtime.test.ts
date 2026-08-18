import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  demoCountCustomerRequestsThisMonth,
  demoCreateRequest,
  demoGetStoreDemand,
  demoLogin,
  getDemoState,
  resetDemoState,
} from "@/lib/demo/store";
import { canManageFromRole } from "@/lib/auth/store-role";
import {
  CUSTOMER_PLANS,
  PLUS_MONTHLY_REQUEST_LIMIT,
} from "@/lib/config/constants";
import { bypassConsumerPlanLimits, bypassPlanLimits } from "@/lib/config/env";
import {
  getStoreDemandAction,
  getStoreMetricsAction,
} from "@/lib/services/actions";
import type { Profile } from "@/types/database";

beforeEach(() => {
  resetDemoState();
  process.env.FINDIT_DEMO_MODE = "true";
  process.env.FINDIT_BYPASS_PLAN_LIMITS = "false";
  process.env.FINDIT_PILOT_MODE = "false";
});

function addCustomer(plan: "free" | "plus"): Profile {
  const state = getDemoState();
  const template = state.profiles[0];
  const profile: Profile = {
    ...template,
    id: randomUUID(),
    email: `${plan}-${randomUUID()}@demo.findit.local`,
    subscription_plan: plan,
    account_type: "customer",
  };
  state.profiles.push(profile);
  return profile;
}

function seedUsedFinds(customerId: string, count: number) {
  const state = getDemoState();
  const template = state.requests[0];
  const created = new Date();
  created.setHours(0, 5, 0, 0);
  if (created.getTime() > Date.now() - 2 * 3600_000) {
    created.setTime(Date.now() - 3 * 3600_000);
  }
  for (let i = 0; i < count; i++) {
    state.requests.push({
      ...template,
      id: randomUUID(),
      customer_id: customerId,
      product_name: `Seeded Find ${i}`,
      normalized_product_name: `seeded find ${i}`,
      status: "expired",
      created_at: created.toISOString(),
    });
  }
}

function ask(customerId: string, name: string) {
  return demoCreateRequest({
    customerId,
    productName: name,
    city: "Falls Church",
    state: "VA",
    postalCode: "22044",
    radiusMiles: 10,
    expirationHours: 24,
    forceDuplicate: true,
  });
}

describe("consumer Find caps", () => {
  it("allows the 5th FINDIT Find and blocks the 6th with upgrade copy", () => {
    const customer = addCustomer("free");
    seedUsedFinds(customer.id, 4);
    const fifth = ask(customer.id, "Fifth Find");
    expect(fifth.blocked).toBeUndefined();
    expect(fifth.request.product_name).toBe("Fifth Find");

    const sixth = ask(customer.id, "Sixth Find");
    expect(sixth.blocked).toMatch(/5 free Finds this month/i);
  });

  it("does not refund a cancelled Find toward the monthly cap", () => {
    const customer = addCustomer("free");
    seedUsedFinds(customer.id, 4);
    const fifth = ask(customer.id, "Fifth Find");
    expect(fifth.blocked).toBeUndefined();
    fifth.request.status = "cancelled";

    expect(demoCountCustomerRequestsThisMonth(customer.id)).toBe(5);

    const sixth = ask(customer.id, "Sixth after cancel");
    expect(sixth.blocked).toMatch(/5 free Finds this month/i);
  });

  it("lets the same account create more Finds on FINDIT+", () => {
    const customer = addCustomer("plus");
    seedUsedFinds(customer.id, CUSTOMER_PLANS.free.monthlyRequests!);
    const stillAllowed = ask(customer.id, "Plus still has room");
    expect(stillAllowed.blocked).toBeUndefined();

    seedUsedFinds(
      customer.id,
      PLUS_MONTHLY_REQUEST_LIMIT - CUSTOMER_PLANS.free.monthlyRequests! - 1
    );
    const atCap = ask(customer.id, "Plus at cap");
    expect(atCap.blocked).toMatch(/FINDIT\+ includes 25 Finds per month/i);
  });
});

describe("pilot vs consumer bypass", () => {
  it("does not skip consumer Finds when only pilot mode is on", () => {
    process.env.FINDIT_PILOT_MODE = "true";
    process.env.FINDIT_BYPASS_PLAN_LIMITS = "false";
    expect(bypassPlanLimits()).toBe(true);
    expect(bypassConsumerPlanLimits()).toBe(false);
  });
});

describe("owner analytics vs employee inbox", () => {
  it("does not treat employees as managers for demand and metrics", async () => {
    const abc = getDemoState().stores.find((s) => s.slug === "abc-market")!;
    const employee = demoLogin("employee@demo.findit.local", "demo1234")!;
    const owner = getDemoState().profiles.find(
      (p) => p.email === "owner@demo.findit.local"
    )!;
    const empMember = getDemoState().storeMembers.find(
      (m) => m.store_id === abc.id && m.user_id === employee.id
    )!;
    const ownerMember = getDemoState().storeMembers.find(
      (m) => m.store_id === abc.id && m.user_id === owner.id
    )!;

    expect(canManageFromRole(empMember.role)).toBe(false);
    expect(canManageFromRole(ownerMember.role)).toBe(true);
    expect(demoGetStoreDemand(abc.id).length).toBeGreaterThan(0);

    const employeeDemand = await getStoreDemandAction(abc.id);
    const employeeMetrics = await getStoreMetricsAction(abc.id);
    expect(employeeDemand).toEqual([]);
    expect(employeeMetrics.total_received).toBe(0);

    demoLogin("owner@demo.findit.local", "demo1234");
    const ownerDemand = await getStoreDemandAction(abc.id);
    expect(ownerDemand.length).toBeGreaterThan(0);
  });
});
