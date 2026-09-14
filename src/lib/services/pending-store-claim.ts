import { hasVerifiedEmailIdentity } from "@/lib/services/hub-policy";

type ClaimRow = {
  id: string;
  claim_code_hash: string;
  code_expires_at: string;
};

/**
 * Attach open Hub pending store-customer rows to a shopper when their profile
 * phone matches the pending claim phone and their email is confirmed.
 */
export async function attachPendingClaimsForPhone(input: {
  // Service-role Supabase client (admin).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  customerId: string;
  phoneE164: string;
}): Promise<number> {
  const { data: authData, error: authError } =
    await input.admin.auth.admin.getUserById(input.customerId);
  if (authError || !hasVerifiedEmailIdentity(authData?.user)) return 0;

  const { data: claims, error } = await input.admin
    .from("store_customer_claims")
    .select("id, claim_code_hash, code_expires_at")
    .eq("phone_e164", input.phoneE164)
    .is("claimed_at", null);
  if (error || !Array.isArray(claims) || !claims.length) return 0;

  let attached = 0;
  const now = Date.now();
  for (const claim of claims as ClaimRow[]) {
    if (!claim?.id || !claim.claim_code_hash) continue;
    if (new Date(claim.code_expires_at).getTime() <= now) {
      const { error: refreshError } = await input.admin
        .from("store_customer_claims")
        .update({
          code_expires_at: new Date(now + 24 * 60 * 60_000).toISOString(),
        })
        .eq("id", claim.id)
        .is("claimed_at", null);
      if (refreshError) {
        console.error(
          "[FINDIT] pending claim refresh failed",
          refreshError.message
        );
        continue;
      }
    }

    const { error: claimError } = await input.admin.rpc(
      "claim_pending_store_customer",
      {
        p_claim_code_hash: claim.claim_code_hash,
        p_customer_id: input.customerId,
        p_claim_idempotency_key: `phone-attach:${input.customerId}:${claim.id}`,
      }
    );
    if (claimError) {
      console.error("[FINDIT] pending claim attach failed", {
        claimId: claim.id.slice(0, 8),
        message: claimError.message,
      });
      continue;
    }
    attached += 1;
  }
  return attached;
}
