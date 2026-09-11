import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { ShopperFinditPoints } from "@/components/customer/findit-points";
import { getMyStoreRewardsAction } from "@/lib/services/loyalty";
import { formatRelativeTime } from "@/lib/utils";

export default async function ShopperRewardsPage() {
  const relationships = await getMyStoreRewardsAction();

  return (
    <div className="mx-auto max-w-xl px-5 py-8 pb-12 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight">Rewards</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Two separate programs. They never mix into one balance.
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          1 · FINDIT Points
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Platform rewards for using FINDIT (visits / participation). Run by FINDIT.
        </p>
        <ShopperFinditPoints />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          2 · Store rewards
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Loyalty funded by each store when they confirm your purchase on the Hub.
        </p>
        <div className="mt-3 space-y-3">
          {relationships.length === 0 ? (
            <Card className="p-5">
              <p className="text-sm text-ink-muted">
                Store points appear after a participating store confirms your purchase.
              </p>
              <Link
                href="/profile"
                className="mt-3 inline-block text-sm font-semibold underline"
              >
                Manage your lookup phone
              </Link>
            </Card>
          ) : (
            relationships.map((relationship) => {
              const store = Array.isArray(relationship.store)
                ? relationship.store[0]
                : relationship.store;
              return (
                <Card key={relationship.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {store?.name || "Store"}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Store-funded · {relationship.confirmed_purchases} confirmed
                        purchase
                        {relationship.confirmed_purchases === 1 ? "" : "s"} · Updated{" "}
                        {formatRelativeTime(relationship.last_seen_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold tabular-nums">
                        {relationship.points_balance}
                      </p>
                      <p className="text-xs uppercase tracking-wider text-ink-muted">
                        store pts
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
