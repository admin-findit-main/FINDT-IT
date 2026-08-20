import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FREE_MAX_RADIUS_MILES,
  FREE_MONTHLY_REQUEST_LIMIT,
  PLUS_MAX_RADIUS_MILES,
  PLUS_MONTHLY_REQUEST_LIMIT,
  STORE_PLANS_FREE_MONTHLY,
} from "../constants";
import { MAX_CUSTOMER_RADIUS_MILES } from "../routing";

const here = dirname(fileURLToPath(import.meta.url));
const edgePath = resolve(
  here,
  "../../../../supabase/functions/_shared/domain.ts"
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
    expect(edge).toContain('"Tobacco & Vape"');
    expect(edge).toContain('isAgeRestrictedFind');
  });

  it("keeps the monthly Find cap trigger in lockstep with plan limits", () => {
    const sql = readFileSync(capMigrationPath, "utf8");
    expect(sql).toContain(`when plan = 'plus' then ${PLUS_MONTHLY_REQUEST_LIMIT}`);
    expect(sql).toContain(`else ${FREE_MONTHLY_REQUEST_LIMIT} end`);
    expect(sql).not.toContain("cancelled");
  });
});
