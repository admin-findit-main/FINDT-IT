import Link from "next/link";
import { Panel } from "@/components/dashboard/shell";
import { StoreCustomerMessageForm } from "@/components/store/customer-message-form";
import { getStoreCustomersAction } from "@/lib/services/loyalty";
import { getStoreMessageAudienceAction } from "@/lib/services/store-customer-messages";
import { getStoreWorkspaceAction } from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";

export default async function StoreCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const [result, audience, workspace] = await Promise.all([
    getStoreCustomersAction(cursor),
    getStoreMessageAudienceAction(),
    getStoreWorkspaceAction(),
  ]);

  if ("error" in result && result.error) {
    return <p className="text-sm text-ink-muted">{result.error}</p>;
  }

  const storeName = workspace?.store?.name || "this store";
  const reachable = "count" in audience ? audience.count : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
        <p className="mt-1 text-sm text-ink-muted">
          People who shopped at <span className="font-medium text-ink">{storeName}</span>.
          Store points stay here — FINDIT Points are separate on the shopper Rewards page.
        </p>
      </div>

      <Panel title="Message customers">
        <StoreCustomerMessageForm
          initialCount={reachable}
          storeName={storeName}
        />
      </Panel>

      <Panel title="Store customers">
        {result.rows.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Customers appear after your team confirms their first purchase on the Hub.
          </p>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {result.rows.map((customer) => (
              <li
                key={customer.id}
                className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{customer.displayName}</p>
                  <p className="text-xs text-ink-muted">
                    Last activity {formatRelativeTime(customer.lastSeenAt)}
                    {customer.marketingOptIn ? " · Promo opt-in" : ""}
                  </p>
                </div>
                <p className="tabular-nums text-ink-muted">
                  {customer.confirmedPurchases} purchase
                  {customer.confirmedPurchases === 1 ? "" : "s"}
                </p>
                <p className="min-w-24 text-right font-semibold tabular-nums">
                  {customer.pointsBalance} pts
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {result.nextCursor ? (
        <div className="flex justify-end">
          <Link
            href={`/store/customers?cursor=${encodeURIComponent(result.nextCursor)}`}
            className="inline-flex min-h-11 items-center border border-hairline-strong px-4 text-sm font-semibold"
          >
            Next customers
          </Link>
        </div>
      ) : null}
    </div>
  );
}
