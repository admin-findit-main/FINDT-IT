import { beforeEach, describe, expect, it } from "vitest";
import {
  demoCreateRequest,
  demoFulfillRequest,
  demoLogin,
  demoRespondToRequest,
  demoRouteRequestToStores,
  demoStillLooking,
  getDemoState,
  resetDemoState,
} from "@/lib/demo/store";
import {
  estimateZipDistanceMiles,
  selectEligibleStores,
  storeCoversCustomerZip,
} from "@/lib/services/routing";
import {
  canRebroadcastStillLooking,
  deriveRequestStatus,
  isNearDuplicateRequest,
  responseTimeSeconds,
  median,
} from "@/lib/services/request-lifecycle";
import { isStoreOpenAt } from "@/lib/services/store-hours";
import { bypassConsumerPlanLimits, bypassPlanLimits, isPilotMode } from "@/lib/config/env";

beforeEach(() => {
  resetDemoState();
  process.env.FINDIT_DEMO_MODE = "true";
  process.env.FINDIT_BYPASS_PLAN_LIMITS = "true";
  process.env.FINDIT_PILOT_MODE = "false";
});

describe("routing engine", () => {
  it("matches same ZIP as zero miles", () => {
    expect(estimateZipDistanceMiles("22044", "22044")).toBe(0);
  });

  it("excludes wrong category stores", () => {
    const { eligible, excluded } = selectEligibleStores({
      request: {
        id: "r1",
        postal_code: "22044",
        city: "Falls Church",
        category: "Electronics",
        radius_miles: 10,
      },
      stores: [
        {
          id: "grocery",
          is_active: true,
          is_suspended: false,
          postal_code: "22044",
          city: "Falls Church",
          service_radius_miles: 10,
          categories: ["Grocery"],
          service_zips: ["22044"],
        },
        {
          id: "electronics",
          is_active: true,
          is_suspended: false,
          postal_code: "22044",
          city: "Falls Church",
          service_radius_miles: 10,
          categories: ["Electronics"],
          service_zips: ["22044"],
        },
      ],
    });
    expect(eligible.map((e) => e.storeId)).toEqual(["electronics"]);
    expect(excluded.some((e) => e.reason === "category")).toBe(true);
  });

  it("excludes inactive and suspended stores", () => {
    const { eligible } = selectEligibleStores({
      request: {
        id: "r1",
        postal_code: "22044",
        category: null,
        radius_miles: 10,
      },
      stores: [
        {
          id: "inactive",
          is_active: false,
          is_suspended: false,
          postal_code: "22044",
          service_radius_miles: 10,
          categories: [],
          service_zips: ["22044"],
        },
        {
          id: "suspended",
          is_active: true,
          is_suspended: true,
          postal_code: "22044",
          service_radius_miles: 10,
          categories: [],
          service_zips: ["22044"],
        },
      ],
    });
    expect(eligible).toHaveLength(0);
  });

  it("excludes stores outside service area", () => {
    expect(
      storeCoversCustomerZip(
        { postal_code: "10001", service_zips: ["10001"] },
        "22044"
      )
    ).toBe(false);
  });

  it("prevents duplicate targeting in demo route", () => {
    const customer = demoLogin("customer@demo.findit.local", "demo1234")!;
    const { request, storesTargeted } = demoCreateRequest({
      customerId: customer.id,
      productName: "Unique Routing Widget",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 10,
      expirationHours: 24,
    });
    const first = storesTargeted;
    const second = demoRouteRequestToStores(request.id);
    expect(second).toBe(first);
  });
});

describe("request lifecycle", () => {
  it("derives statuses", () => {
    expect(deriveRequestStatus({ responseCount: 0, targetCount: 3 })).toBe("active");
    expect(deriveRequestStatus({ responseCount: 1, targetCount: 3 })).toBe(
      "partially_answered"
    );
    expect(deriveRequestStatus({ responseCount: 3, targetCount: 3 })).toBe("answered");
    expect(deriveRequestStatus({ responseCount: 1, targetCount: 3, fulfilled: true })).toBe(
      "fulfilled"
    );
  });

  it("computes response timing", () => {
    const start = new Date("2026-01-01T12:00:00Z");
    const end = new Date("2026-01-01T12:03:00Z");
    expect(responseTimeSeconds(start, end)).toBe(180);
    expect(median([10, 30, 20])).toBe(20);
  });

  it("detects near-duplicate requests", () => {
    const dup = isNearDuplicateRequest({
      normalizedProductName: "blue takis",
      category: "Grocery",
      existing: [
        {
          id: "x",
          normalized_product_name: "blue takis",
          category: "Grocery",
          status: "active",
          created_at: new Date().toISOString(),
        },
      ],
    });
    expect(dup.duplicate).toBe(true);
    expect(dup.existingId).toBe("x");
  });

  it("fulfills a request and stops active demand treatment", () => {
    const customer = demoLogin("customer@demo.findit.local", "demo1234")!;
    const { request } = demoCreateRequest({
      customerId: customer.id,
      productName: "Fulfill Me Snack",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 10,
      expirationHours: 24,
      forceDuplicate: true,
    });
    const abc = getDemoState().stores.find((s) => s.slug === "abc-market")!;
    const employee = demoLogin("employee@demo.findit.local", "demo1234")!;
    demoRespondToRequest({
      requestId: request.id,
      storeId: abc.id,
      userId: employee.id,
      responseType: "in_stock",
    });
    const fulfilled = demoFulfillRequest({
      requestId: request.id,
      customerId: customer.id,
      storeId: abc.id,
      foundWithFindit: true,
    });
    expect(fulfilled.status).toBe("fulfilled");
    expect(fulfilled.found_with_findit).toBe(true);
  });

  it("supports still looking rebroadcast with cooldown rules", () => {
    const check = canRebroadcastStillLooking({
      status: "active",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      stillLookingCount: 0,
      lastRebroadcastAt: null,
    });
    expect(check.ok).toBe(true);

    const customer = demoLogin("customer@demo.findit.local", "demo1234")!;
    const { request } = demoCreateRequest({
      customerId: customer.id,
      productName: "Still Looking Item",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 10,
      expirationHours: 24,
      forceDuplicate: true,
    });
    const result = demoStillLooking({
      requestId: request.id,
      customerId: customer.id,
    });
    expect(result.request.still_looking_count).toBe(1);
  });
});

describe("store hours", () => {
  it("detects closed days", () => {
    const info = isStoreOpenAt(
      [
        {
          day_of_week: new Date().getDay(),
          open_time: null,
          close_time: null,
          is_closed: true,
        },
      ],
      new Date()
    );
    expect(info.open).toBe(false);
  });
});

describe("pilot mode flags", () => {
  it("relaxes store routing caps when pilot mode is on, not consumer Finds", () => {
    process.env.FINDIT_PILOT_MODE = "true";
    process.env.FINDIT_BYPASS_PLAN_LIMITS = "false";
    expect(isPilotMode()).toBe(true);
    expect(bypassPlanLimits()).toBe(true);
    expect(bypassConsumerPlanLimits()).toBe(false);
  });

  it("respects bypass off when pilot mode is off", () => {
    process.env.FINDIT_PILOT_MODE = "false";
    process.env.FINDIT_BYPASS_PLAN_LIMITS = "false";
    expect(isPilotMode()).toBe(false);
    expect(bypassPlanLimits()).toBe(false);
    expect(bypassConsumerPlanLimits()).toBe(false);
  });

  it("skips consumer Finds only with FINDIT_BYPASS_PLAN_LIMITS", () => {
    process.env.FINDIT_PILOT_MODE = "false";
    process.env.FINDIT_BYPASS_PLAN_LIMITS = "true";
    expect(bypassConsumerPlanLimits()).toBe(true);
  });
});

describe("role permissions on response", () => {
  it("blocks non-members from responding", () => {
    const customer = demoLogin("customer@demo.findit.local", "demo1234")!;
    const { request } = demoCreateRequest({
      customerId: customer.id,
      productName: "Auth Guard Item",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 10,
      expirationHours: 24,
      forceDuplicate: true,
    });
    const abc = getDemoState().stores.find((s) => s.slug === "abc-market")!;
    expect(() =>
      demoRespondToRequest({
        requestId: request.id,
        storeId: abc.id,
        userId: customer.id,
        responseType: "in_stock",
      })
    ).toThrow(/member/i);
  });
});
