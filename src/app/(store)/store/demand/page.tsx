"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { GlassSelect, Overline } from "@/components/ui/glass";
import { BackLink } from "@/components/shared/app-header";
import {
  getStoreDemandAction,
  getStoreMetricsAction,
  getUserStoresAction,
} from "@/lib/services/actions";
import type { DemandItem, Store, StoreMetrics } from "@/types/database";

export default function DemandPage() {
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState<(Store & { role: string })[]>([]);
  const [demand, setDemand] = useState<DemandItem[]>([]);
  const [metrics, setMetrics] = useState<StoreMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserStoresAction().then((s) => {
      setStores(s);
      if (s[0]) setStoreId(s[0].id);
      else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    Promise.all([getStoreDemandAction(storeId), getStoreMetricsAction(storeId)]).then(
      ([d, m]) => {
        setDemand(d);
        setMetrics(m);
        setLoading(false);
      }
    );
  }, [storeId]);

  const missing = useMemo(
    () =>
      [...demand]
        .filter((d) => d.out_of_stock_count > 0 || d.unanswered_count > 0)
        .sort((a, b) => b.opportunity_score - a.opportunity_score),
    [demand]
  );

  return (
    <div className="px-5 pt-6 md:px-8 md:pt-8">
      <BackLink href="/store" label="Store home" className="mb-2 md:hidden" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Customer Demand
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Anonymous insights from nearby product asks.
          </p>
        </div>
        {stores.length > 1 ? (
          <GlassSelect
            aria-label="Select store"
            className="h-10 w-auto px-3 text-sm"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </GlassSelect>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : demand.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Demand insights will appear as customers make requests in your area."
            description="No fake analytics — only real request data."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              ["Today", metrics?.requests_today ?? 0],
              ["This week", metrics?.week_received ?? 0],
              ["Answered", metrics?.total_answered ?? 0],
            ].map(([label, value]) => (
              <Card key={String(label)} className="p-4">
                <Overline>{label}</Overline>
                <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
              </Card>
            ))}
          </div>

          <section className="mt-10">
            <h2 className="text-lg font-semibold text-ink">Most requested</h2>
            <Card sheen className="mt-4 divide-y divide-hairline-strong p-2">
              {demand.slice(0, 8).map((item) => (
                <div
                  key={item.normalized_product_name}
                  className="flex items-start justify-between gap-3 px-3 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{item.product_name}</p>
                    {item.insight ? (
                      <p className="mt-1 text-sm text-ink-muted">{item.insight}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-lg font-bold tabular-nums text-ink">
                    {item.request_count}
                  </p>
                </div>
              ))}
            </Card>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-semibold text-ink">Missed demand</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Unanswered or out-of-stock asks near your store.
            </p>
            <div className="mt-4 space-y-3">
              {missing.length === 0 ? (
                <EmptyState title="No stocking ideas yet — keep answering requests." />
              ) : (
                missing.slice(0, 8).map((item) => (
                  <Card key={item.normalized_product_name} className="p-5">
                    {item.consider_stocking ? (
                      <Overline className="text-order-ink">
                        High demand · Consider stocking
                      </Overline>
                    ) : (
                      <Overline>Missed demand</Overline>
                    )}
                    <p className="mt-1 text-lg font-semibold text-ink">
                      {item.product_name}
                    </p>
                    <p className="mt-2 text-sm text-ink-muted">
                      {item.request_count} people searched nearby
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {item.unanswered_count} unanswered · {item.out_of_stock_count} out of
                      stock
                    </p>
                  </Card>
                ))
              )}
            </div>
          </section>

          <section className="mt-10 pb-8">
            <h2 className="text-lg font-semibold text-ink">
              How you&apos;re answering
            </h2>
            <Card sheen className="mt-4 grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
              {[
                ["In stock", `${metrics?.in_stock_pct ?? 0}%`],
                ["Out of stock", `${metrics?.out_of_stock_pct ?? 0}%`],
                ["Can order", `${metrics?.can_order_pct ?? 0}%`],
                ["Waiting", `${metrics?.unanswered_pct ?? 0}%`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="glass-subtle rounded-glass-lg px-3 py-2.5"
                >
                  <p className="text-xs text-ink-muted">{label}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-ink">
                    {value}
                  </p>
                </div>
              ))}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
