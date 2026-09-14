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
        FINDIT Points and store points stay separate.
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          FINDIT Points
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          From using FINDIT.
        </p>
        <ShopperFinditPoints />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Store rewards
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Points each store gives you when they confirm a purchase.
        </p>
        <div className="mt-3 space-y-3">
          {relationships.length === 0 ? (
            <Card className="p-5">
              <p className="text-sm text-ink-muted">
                No store points yet. Add your phone in Profile if a store already
                looked you up on the Hub.
              </p>
              <Link
                href="/profile"
                className="mt-3 inline-block text-sm font-semibold underline"
              >
                Open profile
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
                        {relationship.confirmed_purchases} purchase
                        {relationship.confirmed_purchases === 1 ? "" : "s"}
                        {" · "}
                        Updated {formatRelativeTime(relationship.last_seen_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold tabular-nums">
                        {relationship.points_balance}
                      </p>
                      <p className="text-xs uppercase tracking-wider text-ink-muted">
                        pts
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
