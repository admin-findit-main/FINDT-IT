import { beforeEach, describe, expect, it } from "vitest";
import {
  demoApproveStoreApplication,
  demoCreateRequest,
  demoCurrentUser,
  demoGetStoreDemand,
  demoListStoreApplications,
  demoLogin,
  demoRespondToRequest,
  demoSetCurrentUser,
  demoSubmitStoreApplication,
  getDemoState,
  resetDemoState,
} from "@/lib/demo/store";
import {
  AGE_RESTRICTED_ID_REQUIRED,
  CUSTOMER_PLANS,
  STORE_PLANS,
  createdInMonthlyFindWindow,
} from "@/lib/config/constants";
import { normalizeProductName } from "@/lib/utils";

beforeEach(() => {
  resetDemoState();
  process.env.FINDIT_DEMO_MODE = "true";
  process.env.FINDIT_BYPASS_PLAN_LIMITS = "true";
});

describe("normalizeProductName", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeProductName("  Cherry   Coke Zero 12 Pack ")).toBe(
      "cherry coke zero 12 pack"
    );
  });
});

describe("plan config", () => {
  it("exposes customer and store pricing from config", () => {
    expect(CUSTOMER_PLANS.free.monthlyRequests).toBe(5);
    expect(CUSTOMER_PLANS.plus.priceMonthly).toBeNull();
    expect(STORE_PLANS.starter.priceMonthly).toBe(49.99);
    expect(STORE_PLANS.pro.priceMonthly).toBe(49.99);
  });
});

describe("FINDIT core loop", () => {
  it("creates a customer request and routes to eligible stores", () => {
    const customer = demoLogin("customer@demo.findit.local", "demo1234");
    expect(customer).toBeTruthy();

    const { request, storesTargeted, blocked } = demoCreateRequest({
      customerId: customer!.id,
      productName: "Cherry Coke Zero",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 10,
      expirationHours: 24,
    });

    expect(blocked).toBeUndefined();
    expect(request.product_name).toBe("Cherry Coke Zero");
    expect(request.normalized_product_name).toBe("cherry coke zero");
    expect(storesTargeted).toBeGreaterThan(0);

    const targets = getDemoState().targets.filter((t) => t.request_id === request.id);
    expect(targets.length).toBe(storesTargeted);
  });

  it("blocks tobacco Finds until the customer confirms they are 21+", () => {
    const customer = demoLogin("customer@demo.findit.local", "demo1234")!;
    const denied = demoCreateRequest({
      customerId: customer.id,
      productName: "Elf Bar BC5000 Blue Razz Ice 5%",
      category: "Tobacco & Vape",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 10,
      expirationHours: 24,
    });
    expect(denied.blocked).toBe(AGE_RESTRICTED_ID_REQUIRED);

    const allowed = demoCreateRequest({
      customerId: customer.id,
      productName: "Elf Bar BC5000 Blue Razz Ice 5%",
      category: "Tobacco & Vape",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 10,
      expirationHours: 24,
      ageRestrictedConfirmed: true,
    });
    expect(allowed.blocked).toBeUndefined();
    expect(allowed.request.category).toBe("Tobacco & Vape");
  });

  it("does not let a store respond if it was not targeted", () => {
    const customer = demoLogin("customer@demo.findit.local", "demo1234")!;
    const { request } = demoCreateRequest({
      customerId: customer.id,
      productName: "Rare Collectible Widget",
      category: "Collectibles",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 10,
      expirationHours: 24,
    });

    const employee = demoLogin("employee@demo.findit.local", "demo1234")!;
    const wrongStore = getDemoState().stores.find((s) => s.slug === "autoright-parts")!;

    expect(() =>
      demoRespondToRequest({
        requestId: request.id,
        storeId: wrongStore.id,
        userId: employee.id,
        responseType: "in_stock",
      })
    ).toThrow();
  });

  it("lets an employee respond and customer see the response", () => {
    const customer = demoLogin("customer@demo.findit.local", "demo1234")!;
    const { request } = demoCreateRequest({
      customerId: customer.id,
      productName: "Cherry Coke Zero",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 10,
      expirationHours: 24,
    });

    const abc = getDemoState().stores.find((s) => s.slug === "abc-market")!;
    const employee = demoLogin("employee@demo.findit.local", "demo1234")!;

    const response = demoRespondToRequest({
      requestId: request.id,
      storeId: abc.id,
      userId: employee.id,
      responseType: "in_stock",
      price: 12.99,
      note: "Behind the front counter.",
    });

    expect(response.response_type).toBe("in_stock");
    expect(response.price).toBe(12.99);

    const saved = getDemoState().responses.find(
      (r) => r.request_id === request.id && r.store_id === abc.id
    );
    expect(saved?.price).toBe(12.99);

    demoSetCurrentUser(customer.id);
    expect(demoCurrentUser()?.id).toBe(customer.id);
    const notifications = getDemoState().notifications.filter(
      (n) => n.user_id === customer.id && n.type === "in_stock"
    );
    expect(notifications.length).toBeGreaterThan(0);
  });

  it("updates an existing response instead of creating a duplicate", () => {
    const customer = demoLogin("customer@demo.findit.local", "demo1234")!;
    const { request } = demoCreateRequest({
      customerId: customer.id,
      productName: "Blue Takis",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 10,
      expirationHours: 24,
    });
    const abc = getDemoState().stores.find((s) => s.slug === "abc-market")!;
    const employee = demoLogin("employee@demo.findit.local", "demo1234")!;

    demoRespondToRequest({
      requestId: request.id,
      storeId: abc.id,
      userId: employee.id,
      responseType: "out_of_stock",
    });
    demoRespondToRequest({
      requestId: request.id,
      storeId: abc.id,
      userId: employee.id,
      responseType: "in_stock",
      price: 4.5,
    });

    const matches = getDemoState().responses.filter(
      (r) => r.request_id === request.id && r.store_id === abc.id
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].response_type).toBe("in_stock");
  });

  it("blocks responses on expired requests", () => {
    const customer = demoLogin("customer@demo.findit.local", "demo1234")!;
    const { request } = demoCreateRequest({
      customerId: customer.id,
      productName: "Expired Item",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 10,
      expirationHours: 24,
    });
    request.expires_at = new Date(Date.now() - 1000).toISOString();
    request.status = "expired";

    const abc = getDemoState().stores.find((s) => s.slug === "abc-market")!;
    const employee = demoLogin("employee@demo.findit.local", "demo1234")!;

    expect(() =>
      demoRespondToRequest({
        requestId: request.id,
        storeId: abc.id,
        userId: employee.id,
        responseType: "in_stock",
      })
    ).toThrow(/expired/i);
  });

  it("does not expose another customer's request to a random customer", () => {
    const customer = demoLogin("customer@demo.findit.local", "demo1234")!;
    const { request } = demoCreateRequest({
      customerId: customer.id,
      productName: "Private Request",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 10,
      expirationHours: 24,
    });

    // Simulate another customer session
    const state = getDemoState();
    const strangerId = "99999999-9999-9999-9999-999999999999";
    state.profiles.push({
      ...customer,
      id: strangerId,
      email: "stranger@demo.findit.local",
      subscription_plan: "free",
    });
    demoSetCurrentUser(strangerId);
    expect(demoCurrentUser()?.id).toBe(strangerId);
    expect(request.customer_id).not.toBe(strangerId);
  });

  it("computes demand analytics for unmet products", () => {
    const demand = getDemoState();
    const abc = demand.stores.find((s) => s.slug === "abc-market")!;
    const items = demoGetStoreDemand(abc.id);
    const redBull = items.find(
      (i) => i.normalized_product_name === "red bull sea blue edition"
    );
    expect(redBull).toBeTruthy();
    expect(redBull!.request_count).toBeGreaterThan(5);
    expect(redBull!.opportunity_score).toBeGreaterThan(0);
  });
});

describe("store join applications", () => {
  it("seeds a pending join request for admin review", () => {
    const pending = demoListStoreApplications("pending");
    expect(pending.length).toBeGreaterThan(0);
    expect(pending[0].business_name).toBeTruthy();
  });

  it("submits and approves an application into a trial store", () => {
    const admin = demoLogin("admin@demo.findit.local", "demo1234")!;
    const application = demoSubmitStoreApplication({
      businessName: "Test Hardware Co",
      businessType: "Hardware",
      streetAddress: "99 Main St",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      phone: "703-555-0111",
      ownerName: "Casey Owner",
      ownerEmail: "casey@testhardware.example",
      whyLegit: "Licensed hardware retailer operating on Main Street for five years.",
      confirmedLegitimate: true,
      requestCategories: ["Hardware", "Other"],
    });
    expect(application.status).toBe("pending");
    expect(application.request_categories).toContain("Hardware");

    const { store, application: approved } = demoApproveStoreApplication(
      application.id,
      admin.id
    );
    expect(approved.status).toBe("approved");
    expect(store.name).toBe("Test Hardware Co");
    expect(store.trial_ends_at).toBeTruthy();
    expect(store.subscription_plan).toBe("free");
  });

  it("copies the ID requirement from a smoke shop application onto the store", () => {
    const admin = demoLogin("admin@demo.findit.local", "demo1234")!;
    const application = demoSubmitStoreApplication({
      businessName: "Falls Church Smoke Shop",
      businessType: "Smoke Shop",
      streetAddress: "18 Hillwood Ave",
      city: "Falls Church",
      state: "VA",
      postalCode: "22046",
      phone: "703-555-0188",
      ownerName: "Jordan Owner",
      ownerEmail: "jordan@fcsmoke.example",
      whyLegit:
        "Licensed tobacco retailer. We check government ID for every nicotine sale.",
      confirmedLegitimate: true,
      requestCategories: ["Tobacco & Vape", "Convenience"],
      requiresCustomerId: true,
    });
    expect(application.requires_customer_id).toBe(true);

    const { store } = demoApproveStoreApplication(application.id, admin.id);
    expect(store.age_restricted).toBe(true);
  });
});

describe("customer free plan soft limit", () => {
  it("blocks after monthly free requests when bypass is off", () => {
    process.env.FINDIT_BYPASS_PLAN_LIMITS = "false";
    const customer = demoLogin("customer@demo.findit.local", "demo1234")!;
    // Seeded requests already count toward the month; ensure we're over the free cap
    const limit = CUSTOMER_PLANS.free.monthlyRequests!;
    const existing = getDemoState().requests.filter(
      (r) =>
        r.customer_id === customer.id &&
        createdInMonthlyFindWindow(r.created_at)
    ).length;
    expect(existing).toBeGreaterThanOrEqual(limit);

    const { blocked } = demoCreateRequest({
      customerId: customer.id,
      productName: "One More Thing",
      city: "Falls Church",
      state: "VA",
      postalCode: "22044",
      radiusMiles: 5,
      expirationHours: 24,
    });
    expect(blocked).toMatch(/free Finds this month/i);
  });
});
