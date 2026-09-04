import { Panel } from "@/components/dashboard/shell";
import { PaymentsComingSoon } from "@/components/shared/coming-soon";
import { StoreBillingActions } from "@/components/store/billing-actions";
import { StoreUsagePanel } from "@/components/store/usage-panel";
import { getStoreBillingAction } from "@/lib/billing/actions";
import { BILLING_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/config/constants";
import { getStoreUsageSnapshotAction } from "@/lib/visits/engine";

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export default async function StoreSubscriptionPage() {
  const [billing, snapshot] = await Promise.all([
    getStoreBillingAction(),
    getStoreUsageSnapshotAction(),
  ]);
  if (!billing) {
    return <p className="text-sm text-ink-muted">No store linked.</p>;
  }

  const { store, subscription, invoices, settings, plan, priceLabel, statusLabel } =
    billing;
  const trialEnds = subscription?.trial_ends_at || store.trial_ends_at;

  return (
    <div className="space-y-8">
      {snapshot ? <StoreUsagePanel snapshot={snapshot} /> : null}

      {!settings.billing_required ? (
        <div>
          <p className="text-sm text-ink-muted">
            {plan.name}
            {trialEnds ? `. Trial ends ${fmtDate(trialEnds)}.` : "."} Card
            collection is not on yet.
          </p>
          <PaymentsComingSoon />
        </div>
      ) : (
        <>
          <Panel title={plan.name}>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted">Plan</dt>
                <dd className="mt-1 text-lg font-semibold">{plan.name}</dd>
                <dd className="text-ink-muted">{priceLabel}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Status</dt>
                <dd className="mt-1 font-medium">{statusLabel}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Payment</dt>
                <dd className="mt-1">
                  {PAYMENT_STATUS_LABELS[
                    (subscription?.payment_status || "none") as keyof typeof PAYMENT_STATUS_LABELS
                  ] || "None"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Billing method</dt>
                <dd className="mt-1">
                  {BILLING_METHOD_LABELS[
                    (subscription?.billing_method || "none") as keyof typeof BILLING_METHOD_LABELS
                  ] || "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Trial</dt>
                <dd className="mt-1">{trialEnds ? `Ends ${fmtDate(trialEnds)}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Current period</dt>
                <dd className="mt-1">
                  {subscription?.current_period_start
                    ? `${fmtDate(subscription.current_period_start)} – ${fmtDate(subscription.current_period_end)}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Last payment</dt>
                <dd className="mt-1">{fmtDate(subscription?.last_payment_at)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Next renewal</dt>
                <dd className="mt-1">{fmtDate(subscription?.next_payment_at)}</dd>
              </div>
            </dl>
            {subscription?.cancel_at_period_end ? (
              <p className="mt-4 text-sm text-ink-muted">
                Cancellation is scheduled for the end of this period.
              </p>
            ) : null}
            <div className="mt-6">
              <StoreBillingActions
                canManage={billing.canManage}
                hasAccount={Boolean(subscription?.provider_customer_id)}
                hasSubscription={Boolean(subscription?.provider_subscription_id)}
                testMode={billing.testMode}
              />
            </div>
          </Panel>

          <Panel title="Invoices">
            {invoices.length === 0 ? (
              <p className="text-sm text-ink-muted">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-black/[0.06] text-sm">
                {invoices.map((invoice) => (
                  <li key={invoice.id} className="flex justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium capitalize">{invoice.payment_status}</p>
                      <p className="text-ink-muted">
                        {fmtDate(invoice.occurred_at)}
                        {invoice.reference ? ` · ${invoice.reference}` : ""}
                      </p>
                    </div>
                    {invoice.invoice_url ? (
                      <a
                        href={invoice.invoice_url}
                        className="shrink-0 text-ink underline-offset-2 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Receipt
                      </a>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
