/**
 * Payment collection is intentionally disabled.
 * FINDIT calculates invoices; a provider only charges the finalized amount later.
 */

export type CollectInvoiceInput = {
  statementId: string;
  storeId: string;
  amountCents: number;
};

export type CollectInvoiceResult =
  | { ok: true; provider: string; providerPaymentId: string }
  | { ok: false; reason: "disabled" | "not_configured" };

export interface PaymentProvider {
  id: string;
  collectInvoice(input: CollectInvoiceInput): Promise<CollectInvoiceResult>;
}

export class DisabledPaymentProvider implements PaymentProvider {
  id = "none";
  async collectInvoice(): Promise<CollectInvoiceResult> {
    return { ok: false, reason: "disabled" };
  }
}

/** Placeholder for a future FastSpring (or other) collector. Not wired to live charges. */
export class FastSpringPaymentProvider implements PaymentProvider {
  id = "fastspring";
  async collectInvoice(): Promise<CollectInvoiceResult> {
    return { ok: false, reason: "disabled" };
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new DisabledPaymentProvider();
}
