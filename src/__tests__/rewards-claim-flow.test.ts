import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hashRewardsClaimCode } from "@/lib/loyalty/claim-code";
import {
  INVALID_REWARDS_CLAIM_ERROR,
  claimPendingStoreRewards,
  type RewardsClaimDependencies,
} from "@/lib/services/rewards-claim";

const customerId = "10000000-0000-4000-8000-000000000001";

function dependencies(
  overrides: Partial<RewardsClaimDependencies> = {}
): RewardsClaimDependencies {
  return {
    consumeLimit: vi.fn(async () => ({ ok: true })),
    isEligibleCustomer: vi.fn(async () => true),
    claim: vi.fn(async () => ({
      store_customer_id: "20000000-0000-4000-8000-000000000002",
      points_balance: 14,
    })),
    getRelationship: vi.fn(async () => ({
      points_balance: 14,
      store: { name: "Corner Market" },
    })),
    ...overrides,
  };
}

describe("customer pending rewards claim", () => {
  it("requires an eligible authenticated customer before the RPC", async () => {
    const deps = dependencies({
      isEligibleCustomer: vi.fn(async () => false),
    });
    const result = await claimPendingStoreRewards(
      { customerId, phone: "(703) 555-0100", code: "ABCD-2345-WXYZ" },
      deps
    );
    expect(result).toEqual({
      ok: false,
      error: INVALID_REWARDS_CLAIM_ERROR,
      reason: "invalid",
    });
    expect(deps.claim).not.toHaveBeenCalled();
  });

  it("normalizes inputs, uses the HMAC, and derives retry idempotency", async () => {
    const deps = dependencies();
    const result = await claimPendingStoreRewards(
      { customerId, phone: "(703) 555-0100", code: "abcd 2345 wxyz" },
      deps
    );
    const candidateHash = hashRewardsClaimCode(
      "+17035550100",
      "ABCD2345WXYZ"
    );
    expect(deps.claim).toHaveBeenCalledWith({
      claimCodeHash: candidateHash,
      customerId,
      idempotencyKey: `claim:${candidateHash}`,
    });
    expect(result).toEqual({
      ok: true,
      storeName: "Corner Market",
      pointsBalance: 14,
    });
  });

  it("collapses invalid, expired, and used RPC outcomes to one error", async () => {
    const deps = dependencies({ claim: vi.fn(async () => null) });
    const result = await claimPendingStoreRewards(
      { customerId, phone: "+17035550100", code: "ABCD2345WXYZ" },
      deps
    );
    expect(result).toEqual({
      ok: false,
      error: INVALID_REWARDS_CLAIM_ERROR,
      reason: "invalid",
    });
  });
});

describe("rewards claim entry-point policy", () => {
  const route = readFileSync(
    path.join(process.cwd(), "src/app/api/rewards/connect/route.ts"),
    "utf8"
  );
  const service = readFileSync(
    path.join(process.cwd(), "src/lib/services/rewards-claim.ts"),
    "utf8"
  );
  const loyaltyActions = readFileSync(
    path.join(process.cwd(), "src/lib/services/loyalty.ts"),
    "utf8"
  );
  const mobileApi = readFileSync(
    path.join(process.cwd(), "apps/customer-mobile/lib/api.ts"),
    "utf8"
  );
  const mobileScreen = readFileSync(
    path.join(
      process.cwd(),
      "apps/customer-mobile/app/(app)/(tabs)/rewards.tsx"
    ),
    "utf8"
  );

  it("verifies bearer JWTs before invoking the shared service", () => {
    expect(route).toContain("Bearer");
    expect(route).toContain("userClient.auth.getUser()");
    expect(route).toContain("claimPendingStoreRewards({");
    expect(route.indexOf("userClient.auth.getUser()")).toBeLessThan(
      route.indexOf("claimPendingStoreRewards({")
    );
  });

  it("authenticates the web action and invokes the same service", () => {
    const action = loyaltyActions.slice(
      loyaltyActions.indexOf("function connectMyStoreRewardsAction")
    );
    expect(action).toContain("getCurrentProfile()");
    expect(action).toContain('profile.account_type !== "customer"');
    expect(action).toContain("claimPendingStoreRewards({");
  });

  it("checks suspension and Auth-confirmed email and rate limits by user", () => {
    expect(service).toContain('bucket: "loyalty-claim"');
    expect(service).toContain("key: userId");
    expect(service).toContain("profile.is_suspended === false");
    expect(service).toContain("admin.auth.admin.getUserById(userId)");
    expect(service).toContain("hasVerifiedEmailIdentity(authResult.data.user)");
    expect(service).not.toContain("console.");
  });

  it("keeps privileged material and RPCs out of the mobile client", () => {
    expect(mobileApi).toContain("/api/rewards/connect");
    expect(mobileApi).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(mobileApi).not.toContain("claim_pending_store_customer");
    expect(mobileScreen).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(mobileScreen).not.toContain("claim_pending_store_customer");
  });
});
