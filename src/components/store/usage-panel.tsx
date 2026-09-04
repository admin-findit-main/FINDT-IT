import { formatCents } from "@findit/domain";
import { MetricCard, Panel } from "@/components/dashboard/shell";
import { VisitDisputeButton } from "@/components/store/visit-dispute";
import type { StoreUsageSnapshot } from "@/lib/visits/engine";

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function StoreUsagePanel({ snapshot }: { snapshot: StoreUsageSnapshot }) {
  const { quote, trial, funnel } = snapshot;
  const billLabel = quote.contactSales
    ? "Contact FINDIT"
    : trial
      ? snapshot.formatBilled
      : snapshot.formatEstimated;
  const nextTierLabel = quote.nextTier
    ? quote.nextTier.kind === "contact"
      ? `Contact FINDIT at ${quote.nextTier.minVisits.toLocaleString()} verified visits`
      : `${formatCents(quote.nextTier.monthlyCents || 0)}/month at ${quote.nextTier.minVisits.toLocaleString()} verified visits`
    : "Highest listed plan";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {snapshot.monthLabel}
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">
          FINDIT statement
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {fmtDate(snapshot.periodStart)} – {fmtDate(snapshot.periodEnd)}
          {trial
            ? snapshot.trialEndsAt
              ? ` · Trial through ${fmtDate(snapshot.trialEndsAt)}`
              : " · Trial"
            : null}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Verified FINDIT customers"
          value={snapshot.visits}
          hint="Checked in at your Hub this month"
        />
        <MetricCard
          label="Current FINDIT bill"
          value={billLabel}
          hint={
            trial
              ? `Normal price ${snapshot.formatEstimated}`
              : quote.contactSales
                ? "Custom high-volume pricing"
                : quote.tier.name
          }
        />
        <MetricCard
          label="Cost per verified customer"
          value={snapshot.formatEffective}
          hint={quote.tier.name}
        />
        <MetricCard
          label="Current plan"
          value={quote.tier.name}
          hint={
            quote.visitsUntilNextTier != null
              ? `${quote.visitsUntilNextTier} visits to the next plan`
              : nextTierLabel
          }
        />
      </div>

      {trial ? (
        <p className="text-sm text-ink-muted">
          Normal FINDIT price: {snapshot.formatEstimated}. Trial price: $0.00.
          You will not be charged while the trial is active.
        </p>
      ) : null}

      {quote.contactSales ? (
        <p className="text-sm text-ink-muted">
          This location is past listed volume. FINDIT will not auto-charge an
          arbitrary amount. Contact FINDIT for high-volume pricing.
        </p>
      ) : null}

      <p className="text-sm text-ink-muted">
        Next plan: {nextTierLabel}.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Requests matched" value={funnel.matched} />
        <MetricCard label="Store responses" value={funnel.responses} />
        <MetricCard label="Customers selected store" value={funnel.selected} />
        <MetricCard label="Verified visits" value={funnel.verified} />
      </div>

      <Panel title="Verified customers">
        {snapshot.visitsSafe.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No Hub check-ins this month yet. A visit counts after a shopper
            selects your store and scans the Hub QR.
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.06] text-sm">
            {snapshot.visitsSafe.map((visit) => (
              <li key={visit.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium capitalize">
                    {String(visit.status).replace("_", " ")}
                    {visit.billable ? "" : " · not billed"}
                  </p>
                  <p className="text-ink-muted">{fmtDate(visit.verified_at)}</p>
                </div>
                <VisitDisputeButton visitId={visit.id} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Billing activity">
        {snapshot.ledger.length === 0 ? (
          <p className="text-sm text-ink-muted">No billing activity this period.</p>
        ) : (
          <ul className="divide-y divide-black/[0.06] text-sm">
            {snapshot.ledger.map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{row.description}</p>
                  <p className="text-ink-muted">{fmtDate(row.created_at)}</p>
                </div>
                <p className="tabular-nums">{formatCents(row.amount_cents)}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {snapshot.disputes.length ? (
        <Panel title="Reported visits">
          <ul className="divide-y divide-black/[0.06] text-sm">
            {snapshot.disputes.map((row) => (
              <li key={row.id} className="py-3">
                <p className="font-medium capitalize">{row.status}</p>
                <p className="text-ink-muted">{row.reason}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
