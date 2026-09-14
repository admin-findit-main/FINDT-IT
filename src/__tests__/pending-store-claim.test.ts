import { describe, expect, it, vi } from "vitest";
import { attachPendingClaimsForPhone } from "@/lib/services/pending-store-claim";

describe("attachPendingClaimsForPhone", () => {
  it("returns 0 when email is not confirmed", async () => {
    const admin = {
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { email_confirmed_at: null } },
            error: null,
          })),
        },
      },
      from: vi.fn(),
      rpc: vi.fn(),
    };
    const attached = await attachPendingClaimsForPhone({
      admin,
      customerId: "11111111-1111-4111-8111-111111111111",
      phoneE164: "+15551234567",
    });
    expect(attached).toBe(0);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("claims each open pending row for the matching phone", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const updateEq = vi.fn(() => ({
      is: vi.fn(async () => ({ error: null })),
    }));
    const admin = {
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { email_confirmed_at: "2026-01-01T00:00:00Z" } },
            error: null,
          })),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "store_customer_claims") {
          return {
            select: () => ({
              eq: () => ({
                is: async () => ({
                  data: [
                    {
                      id: "22222222-2222-4222-8222-222222222222",
                      claim_code_hash: "a".repeat(64),
                      code_expires_at: "2099-01-01T00:00:00.000Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
            update: () => ({ eq: updateEq }),
          };
        }
        return {};
      }),
      rpc,
    };

    const attached = await attachPendingClaimsForPhone({
      admin,
      customerId: "11111111-1111-4111-8111-111111111111",
      phoneE164: "+15551234567",
    });
    expect(attached).toBe(1);
    expect(rpc).toHaveBeenCalledWith("claim_pending_store_customer", {
      p_claim_code_hash: "a".repeat(64),
      p_customer_id: "11111111-1111-4111-8111-111111111111",
      p_claim_idempotency_key:
        "phone-attach:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222",
    });
  });
});
