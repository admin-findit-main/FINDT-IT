import "server-only";

import { boundUuid, normalizePhoneToE164 } from "@findit/domain";
import {
  hashRewardsClaimCode,
  isValidRewardsClaimCode,
  normalizeRewardsClaimCode,
} from "@/lib/loyalty/claim-code";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";
import { hasVerifiedEmailIdentity } from "@/lib/services/hub-policy";

export const INVALID_REWARDS_CLAIM_ERROR =
  "That store rewards connection is invalid, expired, or already used.";

type ClaimRpcRow = {
  store_customer_id: string;
  points_balance: number;
};

type StoreRelationship = {
  points_balance: number;
  store:
    | { name?: string | null }
    | { name?: string | null }[]
    | null;
};

export type RewardsClaimDependencies = {
  consumeLimit: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  isEligibleCustomer: (userId: string) => Promise<boolean>;
  claim: (input: {
    claimCodeHash: string;
    customerId: string;
    idempotencyKey: string;
  }) => Promise<ClaimRpcRow | null>;
  getRelationship: (
    storeCustomerId: string,
    customerId: string
  ) => Promise<StoreRelationship | null>;
};

export type ConnectStoreRewardsResult =
  | {
      ok: true;
      storeName: string;
      pointsBalance: number;
    }
  | {
      ok: false;
      error: string;
      reason: "invalid" | "rate_limited";
    };

function productionDependencies(): RewardsClaimDependencies {
  const admin = createServiceClient();
  return {
    consumeLimit: async (userId) =>
      consumeRateLimit({
        bucket: "loyalty-claim",
        limit: 5,
        windowMs: 10 * 60_000,
        key: userId,
      }),
    isEligibleCustomer: async (userId) => {
      const [{ data: profile, error: profileError }, authResult] =
        await Promise.all([
          admin
            .from("profiles")
            .select("account_type, is_suspended")
            .eq("id", userId)
            .maybeSingle(),
          admin.auth.admin.getUserById(userId),
        ]);
      return Boolean(
        !profileError &&
          !authResult.error &&
          profile?.account_type === "customer" &&
          profile.is_suspended === false &&
          hasVerifiedEmailIdentity(authResult.data.user)
      );
    },
    claim: async ({ claimCodeHash, customerId, idempotencyKey }) => {
      const { data, error } = await admin.rpc(
        "claim_pending_store_customer",
        {
          p_claim_code_hash: claimCodeHash,
          p_customer_id: customerId,
          p_claim_idempotency_key: idempotencyKey,
        }
      );
      return error ? null : ((data?.[0] as ClaimRpcRow | undefined) || null);
    },
    getRelationship: async (storeCustomerId, customerId) => {
      const { data, error } = await admin
        .from("store_customers")
        .select("points_balance, store:stores(name)")
        .eq("id", storeCustomerId)
        .eq("customer_id", customerId)
        .is("removed_at", null)
        .maybeSingle();
      return error ? null : (data as StoreRelationship | null);
    },
  };
}

/**
 * Claims a pending store balance without exposing the privileged RPC or claim
 * material to either client. Credential failures deliberately collapse to one
 * response so callers cannot distinguish unknown, expired, or used codes.
 */
export async function claimPendingStoreRewards(
  input: { customerId: string; phone: string; code: string },
  dependencies?: RewardsClaimDependencies
): Promise<ConnectStoreRewardsResult> {
  const customerId = boundUuid(input.customerId);
  if (!customerId) {
    return { ok: false, error: INVALID_REWARDS_CLAIM_ERROR, reason: "invalid" };
  }

  const deps = dependencies || productionDependencies();
  const limited = await deps.consumeLimit(customerId);
  if (!limited.ok) {
    return {
      ok: false,
      error: limited.error || "Too many attempts. Wait a few minutes and try again.",
      reason: "rate_limited",
    };
  }

  if (!(await deps.isEligibleCustomer(customerId))) {
    return { ok: false, error: INVALID_REWARDS_CLAIM_ERROR, reason: "invalid" };
  }

  const phone = normalizePhoneToE164(input.phone);
  const code = normalizeRewardsClaimCode(input.code);
  if (!phone.ok || !isValidRewardsClaimCode(code)) {
    return { ok: false, error: INVALID_REWARDS_CLAIM_ERROR, reason: "invalid" };
  }

  const candidateHash = hashRewardsClaimCode(phone.e164, code);
  const row = await deps.claim({
    claimCodeHash: candidateHash,
    customerId,
    idempotencyKey: `claim:${candidateHash}`,
  });
  if (!row) {
    return { ok: false, error: INVALID_REWARDS_CLAIM_ERROR, reason: "invalid" };
  }

  const relationship = await deps.getRelationship(
    row.store_customer_id,
    customerId
  );
  if (!relationship) {
    return { ok: false, error: INVALID_REWARDS_CLAIM_ERROR, reason: "invalid" };
  }
  const store = Array.isArray(relationship.store)
    ? relationship.store[0]
    : relationship.store;
  return {
    ok: true,
    storeName: store?.name?.trim() || "Store",
    pointsBalance: Number(relationship.points_balance ?? row.points_balance ?? 0),
  };
}
