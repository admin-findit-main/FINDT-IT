import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260909022500_customer_find_grants.sql";
const fkIndexMigrationPath =
  "supabase/migrations/20260909023400_customer_find_grants_fk_index.sql";
const triggerRepairMigrationPath =
  "supabase/migrations/20260909034000_fix_monthly_find_cap_coalesce.sql";
const triggerMigrationPath =
  "supabase/migrations/20260326000013_monthly_find_cap.sql";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("customer Find grant contract", () => {
  it("creates an auditable one-month grant table with locked-down RLS", () => {
    const sql = source(migrationPath);
    expect(sql).toContain("create table public.customer_find_grants");
    expect(sql).toContain("references public.profiles(id) on delete restrict");
    expect(sql).toContain(
      "period_start = date_trunc('month', period_start)::date"
    );
    expect(sql).toContain("finds integer not null check (finds > 0)");
    expect(sql).toContain("idempotency_key text not null unique");
    expect(sql).toContain(
      "customer_find_grants_customer_period_idx"
    );
    expect(sql).toContain(
      "alter table public.customer_find_grants force row level security"
    );
    expect(sql).toMatch(
      /revoke all on table public\.customer_find_grants\s+from public, anon, authenticated/
    );
    expect(sql).toContain(
      "grant select on table public.customer_find_grants to authenticated"
    );
    expect(sql).toContain(
      "grant all on table public.customer_find_grants to service_role"
    );
    expect(sql).toContain("to authenticated\n  using ((select auth.uid()) = customer_id)");
    expect(sql).not.toMatch(
      /customer_find_grants[\s\S]*for (insert|update|delete)[\s\S]*to authenticated/
    );

    const fkIndexSql = source(fkIndexMigrationPath);
    expect(fkIndexSql).toContain(
      "create index customer_find_grants_granted_by_idx"
    );
    expect(fkIndexSql).toContain("on public.customer_find_grants (granted_by)");
    expect(fkIndexSql).toContain("where granted_by is not null");
  });

  it("adds grants to the authoritative locked UTC monthly cap", () => {
    const sql = source(migrationPath);
    const triggerSql = source(triggerMigrationPath);
    const triggerFunction = sql.slice(
      sql.indexOf("create or replace function public.enforce_monthly_find_cap")
    );
    expect(triggerSql).toContain(
      "before insert on public.customer_requests"
    );
    expect(triggerSql).toContain(
      "execute function public.enforce_monthly_find_cap()"
    );
    expect(triggerFunction).toContain("security invoker");
    expect(triggerFunction).toContain("set search_path = ''");
    expect(triggerFunction).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(triggerFunction).toContain("from public.customer_find_grants as g");
    expect(triggerFunction).toContain("pg_catalog.sum(g.finds)");
    expect(triggerFunction).toContain("at time zone 'UTC'");
    expect(triggerFunction).toContain("from public.customer_requests as r");
    expect(triggerFunction).toContain(
      "utc_period_start + interval '1 month'"
    );
    expect(triggerFunction).not.toMatch(/\br\.status\b/);
    expect(triggerFunction).toContain(
      "total Finds allowance of % this month"
    );
    expect(triggerFunction).not.toContain("pg_catalog.coalesce");

    const repairSql = source(triggerRepairMigrationPath);
    expect(repairSql).toContain(
      "create or replace function public.enforce_monthly_find_cap()"
    );
    expect(repairSql).not.toContain("pg_catalog.coalesce");
  });

  it("uses bonus-aware limits in web, mobile, and Edge paths", () => {
    for (const file of [
      "src/lib/services/actions.ts",
      "apps/customer-mobile/lib/api.ts",
      "supabase/functions/create-and-route-request/index.ts",
    ]) {
      const text = source(file);
      expect(text).toContain('"customer_find_grants"');
      expect(text).toContain("effectiveMonthlyFindLimit");
      expect(text).toContain("sumMonthlyFindGrants");
      expect(text).toContain('.lt("created_at",');
    }

    const web = source("src/lib/services/actions.ts");
    const mobile = source("apps/customer-mobile/lib/api.ts");
    const edge = source("supabase/functions/create-and-route-request/index.ts");
    expect(web).toContain("bonus,");
    expect(mobile).toContain("bonus,");
    expect(edge).toContain(
      "totalFindsAllowanceReachedMessage(effectiveMonthlyLimit)"
    );
  });

  it("does not write reward points", () => {
    for (const file of [
      migrationPath,
      "src/lib/services/actions.ts",
      "apps/customer-mobile/lib/api.ts",
      "supabase/functions/create-and-route-request/index.ts",
    ]) {
      expect(source(file)).not.toMatch(
        /(?:insert\s+into|update|delete\s+from)\s+public\.reward_ledger/i
      );
    }
  });
});
