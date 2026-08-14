/**
 * Domain security / edge-case tests for shared routing + lifecycle.
 */
import { describe, expect, it } from "vitest";
import {
  canRebroadcastStillLooking,
  deriveRequestStatus,
  isNearDuplicateRequest,
  selectEligibleStores,
  type RoutingStoreCandidate,
} from "../index";

function store(
  partial: Partial<RoutingStoreCandidate> & { id: string }
): RoutingStoreCandidate {
  return {
    is_active: true,
    is_suspended: false,
    postal_code: "23220",
    city: "Richmond",
    service_radius_miles: 10,
    subscription_plan: "starter",
    categories: ["Grocery"],
    service_zips: ["23220"],
    ...partial,
  };
}

describe("cross-store isolation (routing)", () => {
  it("excludes suspended and inactive stores", () => {
    const { eligible, excluded } = selectEligibleStores({
      request: {
        id: "r1",
        postal_code: "23220",
        city: "Richmond",
        category: "Grocery",
        radius_miles: 10,
      },
      stores: [
        store({ id: "ok" }),
        store({ id: "sus", is_suspended: true }),
        store({ id: "off", is_active: false }),
      ],
    });
    expect(eligible.map((e) => e.storeId)).toEqual(["ok"]);
    expect(excluded.some((e) => e.reason === "suspended")).toBe(true);
    expect(excluded.some((e) => e.reason === "inactive")).toBe(true);
  });

  it("does not retarget already targeted stores", () => {
    const { eligible, excluded } = selectEligibleStores({
      request: {
        id: "r1",
        postal_code: "23220",
        city: "Richmond",
        category: "Grocery",
        radius_miles: 10,
      },
      stores: [store({ id: "a" }), store({ id: "b" })],
      alreadyTargetedStoreIds: ["a"],
    });
    expect(eligible.map((e) => e.storeId)).toEqual(["b"]);
    expect(excluded.find((e) => e.storeId === "a")?.reason).toBe(
      "already_targeted"
    );
  });
});

describe("expired / lifecycle", () => {
  it("marks fulfilled and cancelled ahead of response counts", () => {
    expect(
      deriveRequestStatus({ responseCount: 5, targetCount: 5, fulfilled: true })
    ).toBe("fulfilled");
    expect(
      deriveRequestStatus({ responseCount: 0, targetCount: 3, cancelled: true })
    ).toBe("cancelled");
    expect(
      deriveRequestStatus({ responseCount: 0, targetCount: 3, expired: true })
    ).toBe("expired");
  });

  it("blocks still-looking when expired", () => {
    const res = canRebroadcastStillLooking({
      status: "active",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      stillLookingCount: 0,
      lastRebroadcastAt: null,
    });
    expect(res.ok).toBe(false);
  });
});

describe("duplicate responses / requests", () => {
  it("detects near-duplicate active requests in window", () => {
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
});
