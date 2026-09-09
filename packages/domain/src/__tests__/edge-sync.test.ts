import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FREE_MAX_RADIUS_MILES,
  FREE_MONTHLY_REQUEST_LIMIT,
  PILOT_BYPASS_STORE_REQUEST_CAPS,
  PLUS_MAX_RADIUS_MILES,
  PLUS_MONTHLY_REQUEST_LIMIT,
  STORE_PLANS_FREE_MONTHLY,
} from "../constants";
import { MAX_CUSTOMER_RADIUS_MILES } from "../routing";
import {
  PILOT_BYPASS_STORE_REQUEST_CAPS as EDGE_PILOT_BYPASS_STORE_REQUEST_CAPS,
  selectEligibleStores as selectEdgeEligibleStores,
} from "../../../../supabase/functions/_shared/domain";

const here = dirname(fileURLToPath(import.meta.url));
const edgePath = resolve(
  here,
  "../../../../supabase/functions/_shared/domain.ts"
);
const createAndRoutePath = resolve(
  here,
  "../../../../supabase/functions/create-and-route-request/index.ts"
);
const authEmailDomainPath = resolve(here, "../auth-email.ts");
const authEmailEdgePath = resolve(
  here,
  "../../../../supabase/functions/send-email/auth-email.ts"
);
const capMigrationPath = resolve(
  here,
  "../../../../supabase/migrations/20260326000013_monthly_find_cap.sql"
);

describe("Edge domain constants stay aligned with @findit/domain", () => {
  it("keeps the auth email renderer identical for Resend", () => {
    expect(readFileSync(authEmailEdgePath, "utf8")).toBe(
      readFileSync(authEmailDomainPath, "utf8")
    );
  });
  it("matches the Deno copy used by create-and-route-request", () => {
    const edge = readFileSync(edgePath, "utf8");
    expect(edge).toContain(
      `export const STORE_PLANS_FREE_MONTHLY = ${STORE_PLANS_FREE_MONTHLY}`
    );
    expect(edge).toContain(
      `export const MAX_CUSTOMER_RADIUS_MILES = ${MAX_CUSTOMER_RADIUS_MILES}`
    );
    expect(edge).toContain(
      `export const FREE_MONTHLY_REQUEST_LIMIT = ${FREE_MONTHLY_REQUEST_LIMIT}`
    );
    expect(edge).toContain(
      `export const PLUS_MONTHLY_REQUEST_LIMIT = ${PLUS_MONTHLY_REQUEST_LIMIT}`
    );
    expect(edge).toContain(
      `export const PLUS_MAX_RADIUS_MILES = ${PLUS_MAX_RADIUS_MILES}`
    );
    expect(edge).toContain(
      `export const FREE_MAX_RADIUS_MILES = ${FREE_MAX_RADIUS_MILES}`
    );
    expect(edge).toContain(
      `export const PILOT_BYPASS_STORE_REQUEST_CAPS = ${PILOT_BYPASS_STORE_REQUEST_CAPS}`
    );
    expect(edge).toContain("estimateRoutingDistanceMiles");
    expect(edge).toContain("UNKNOWN_ZIP_DISTANCE_MILES");
    expect(edge).toContain('"Tobacco & Vape"');
    expect(edge).toContain('"Dispensary"');
    expect(edge).toContain('dispensary: "dispensary"');
    expect(edge).toContain("a.estimatedMiles - b.estimatedMiles");
    expect(edge).toContain('isAgeRestrictedFind');
  });

  it("uses the synchronized pilot switch in Edge routing while false enforces", () => {
    expect(EDGE_PILOT_BYPASS_STORE_REQUEST_CAPS).toBe(
      PILOT_BYPASS_STORE_REQUEST_CAPS
    );
    const input = {
      request: {
        id: "edge-over-cap",
        postal_code: "22044",
        city: "Falls Church",
        category: "Tobacco & Vape",
        radius_miles: 40,
      },
      stores: [
        {
          id: "nearest-free-store",
          is_active: true,
          is_suspended: false,
          acceptingRequests: true,
          postal_code: "22044",
          city: "Falls Church",
          service_radius_miles: 40,
          subscription_plan: "free",
          categories: ["Tobacco & Vape"],
          service_zips: ["22044"],
          month_targets_received: 20,
          free_plan_monthly_cap: 20,
        },
      ],
    };

    expect(
      selectEdgeEligibleStores({
        ...input,
        bypassPlanCaps: EDGE_PILOT_BYPASS_STORE_REQUEST_CAPS,
      }).eligible.map((store) => store.storeId)
    ).toEqual(["nearest-free-store"]);
    expect(
      selectEdgeEligibleStores({ ...input, bypassPlanCaps: false }).eligible
    ).toEqual([]);

    const createAndRoute = readFileSync(createAndRoutePath, "utf8");
    expect(createAndRoute).toContain(
      "PILOT_BYPASS_STORE_REQUEST_CAPS || bypassConsumerLimits"
    );
    expect(createAndRoute).toContain("bypassPlanCaps: bypassStoreCaps");
  });

  it("keeps the monthly Find cap trigger in lockstep with plan limits", () => {
    const sql = readFileSync(capMigrationPath, "utf8");
    expect(sql).toContain(`when plan = 'plus' then ${PLUS_MONTHLY_REQUEST_LIMIT}`);
    expect(sql).toContain(`else ${FREE_MONTHLY_REQUEST_LIMIT} end`);
    expect(sql).not.toContain("cancelled");
  });
});
