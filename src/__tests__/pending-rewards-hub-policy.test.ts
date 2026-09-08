import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const service = readFileSync(
  path.join(process.cwd(), "src/lib/services/loyalty.ts"),
  "utf8"
);
const workspace = readFileSync(
  path.join(process.cwd(), "src/components/hub/customer-workspace.tsx"),
  "utf8"
);

describe("Hub pending store rewards policy", () => {
  it("uses only service-role RPCs for pending writes and purchases", () => {
    expect(service).toContain('"create_or_get_pending_store_customer"');
    expect(service).toContain('"issue_pending_store_customer_code"');
    expect(service).toContain('"confirm_pending_store_purchase"');
    expect(service).toContain("p_create_idempotency_key: operationId");
    expect(service).toContain("p_issue_idempotency_key: operationId");
    expect(service).toContain(
      "p_expected_claim_code_hash: pending.claimCodeHash"
    );
    expect(service).toContain("p_store_customer_id: pending.relationshipId");
    expect(service).toContain("hashRewardsClaimCode(phoneE164, code)");
    expect(service).not.toContain("auth.admin.createUser");
  });

  it("re-authorizes and rate limits each pending mutation", () => {
    for (const action of [
      "createPendingStoreCustomerAction",
      "issuePendingConnectionCodeAction",
      "confirmPendingPurchaseAction",
    ]) {
      const body = service.slice(service.indexOf(`function ${action}`));
      expect(body).toContain("requireStoreOperator()");
      expect(body).toContain("consumeRateLimit({");
    }
  });

  it("describes pending rewards as store-only and clears private state", () => {
    expect(workspace).toContain("CREATE STORE REWARDS ACCOUNT");
    expect(workspace).toContain("Rewards for this store only");
    expect(workspace).toContain("Not a verified FINDIT account");
    expect(workspace).toContain(
      "Open FINDIT → Rewards → Connect store rewards"
    );
    expect(workspace).toContain("setClaimCode(null)");
  });
});
