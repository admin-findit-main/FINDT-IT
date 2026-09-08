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
    expect(service).toContain('"confirm_pending_store_amount_purchase"');
    expect(service).toContain("p_create_idempotency_key: operationId");
    expect(service).toContain("p_store_customer_id: pending.relationshipId");
    expect(service).toContain(
      "internalPendingClaimHash(parsed.e164, operationId)"
    );
    expect(service).toContain('.update(`${phoneE164}:${operationId}`)');
    expect(service).not.toContain("demo-pending-rewards-key");
    expect(service).not.toContain("randomBytes");
    expect(service).toContain("p_amount_cents: input.amountCents");
    expect(service).not.toContain("auth.admin.createUser");
    expect(service).not.toContain("issuePendingConnectionCodeAction");
  });

  it("re-authorizes and rate limits each pending mutation", () => {
    for (const action of [
      "createPendingStoreCustomerAction",
      "confirmPendingPurchaseAction",
    ]) {
      const body = service.slice(service.indexOf(`function ${action}`));
      expect(body).toContain("requireStoreOperator()");
      expect(body).toContain("consumeRateLimit({");
    }
  });

  it("describes pending rewards as store-only without connection codes", () => {
    expect(workspace).toContain("CREATE STORE REWARDS ACCOUNT");
    expect(workspace).toContain("Rewards for this store only");
    expect(workspace).toContain("Not a verified FINDIT account");
    expect(workspace).not.toContain("Connection code");
    expect(workspace).not.toContain("Connect store rewards");
    expect(workspace).not.toContain("claimCode");
    expect(workspace).toContain(
      "pendingCreateOperationId || crypto.randomUUID()"
    );
  });
});
