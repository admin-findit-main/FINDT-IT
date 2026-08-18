"use client";

import { useEffect, useMemo, useState } from "react";
import { MetricCard, Panel } from "@/components/dashboard/shell";
import { Skeleton } from "@/components/ui/primitives";
import {
  getStoreIncomingRequestsAction,
  getStoreMetricsAction,
  getStoreWorkspaceAction,
} from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";
import type { CustomerRequest, StoreMetrics, StoreResponse } from "@/types/database";

type Incoming = CustomerRequest & { response: StoreResponse | null };

export default function StoreResponsesPage() {
  const [metrics, setMetrics] = useState<StoreMetrics | null>(null);
  const [items, setItems] = useState<Incoming[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ws = await getStoreWorkspaceAction();
      const id = ws?.store?.id;
      if (!id) {
        setLoading(false);
        return;
      }
      const [m, list] = await Promise.all([
        getStoreMetricsAction(id),
        getStoreIncomingRequestsAction(id, "all", "30d"),
      ]);
      setMetrics(m);
      setItems(list.filter((row) => row.response));
      setLoading(false);
    })();
  }, []);

  const counts = useMemo(() => {
    const types = items.map((i) => i.response?.response_type);
    return {
      in: types.filter((t) => t === "in_stock").length,
      out: types.filter((t) => t === "out_of_stock").length,
      order: types.filter((t) => t === "can_order").length,
    };
  }, [items]);

  if (loading) return <Skeleton className="h-48" />;
  if (!metrics) return <p className="text-sm text-ink-muted">No store linked.</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total responses" value={metrics.total_answered} />
        <MetricCard label="In stock" value={counts.in} hint={`${metrics.in_stock_pct}% all-time`} />
        <MetricCard label="Out of stock" value={counts.out} hint={`${metrics.out_of_stock_pct}% all-time`} />
        <MetricCard label="Can order" value={counts.order} hint={`${metrics.can_order_pct}% all-time`} />
      </div>
      <Panel title="Response history (30 days)">
        {items.length === 0 ? (
          <p className="text-sm text-ink-muted">No responses yet.</p>
        ) : (
          <ul className="divide-y divide-black/[0.06] text-sm">
            {items.slice(0, 40).map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-3">
                <span className="truncate font-medium">{row.product_name}</span>
                <span className="shrink-0 text-ink-muted">
                  {row.response?.response_type.replaceAll("_", " ")}
                  {row.response?.price != null ? ` · $${row.response.price}` : ""}
                  {" · "}
                  {formatRelativeTime(row.response?.created_at || row.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
