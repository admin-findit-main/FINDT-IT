"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MetricCard, Panel } from "@/components/dashboard/shell";
import { Skeleton } from "@/components/ui/primitives";
import {
  getStoreDemandAction,
  getStoreIncomingRequestsAction,
  getStoreMetricsAction,
  getStoreSettingsAction,
  getStoreWorkspaceAction,
} from "@/lib/services/actions";
import { listStoreDevicesAction } from "@/lib/services/hub-devices";
import { formatDurationSeconds } from "@/lib/services/request-lifecycle";
import { isStoreOpenAt } from "@/lib/services/store-hours";
import { formatRelativeTime, greetingForHour } from "@/lib/utils";
import type { CustomerRequest, DemandItem, StoreMetrics, StoreResponse } from "@/types/database";

type Incoming = CustomerRequest & { response: StoreResponse | null };

function delta(today: number, yesterday: number) {
  if (!yesterday) return today ? "New vs yesterday" : "No traffic yesterday";
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs yesterday`;
}

function OwnerOverview() {
  const [storeName, setStoreName] = useState("");
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StoreMetrics | null>(null);
  const [items, setItems] = useState<Incoming[]>([]);
  const [demand, setDemand] = useState<DemandItem[]>([]);
  const [hubConnected, setHubConnected] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const ws = await getStoreWorkspaceAction();
    const id = ws?.store?.id;
    if (!id) {
      setLoading(false);
      return;
    }
    setStoreName(ws?.store?.name || "");
    const [m, list, d, settings, devices] = await Promise.all([
      getStoreMetricsAction(id),
      getStoreIncomingRequestsAction(id, "all", "7d"),
      getStoreDemandAction(id),
      getStoreSettingsAction(id),
      listStoreDevicesAction(),
    ]);
    setMetrics(m);
    setItems(list);
    setDemand(d);
    setHubConnected(devices.some((device) => !device.revoked_at));
    if (settings?.hours?.length) {
      setOpenLabel(isStoreOpenAt(settings.hours).open ? "Open" : "Closed");
    } else {
      setOpenLabel(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (!metrics) {
    return <p className="text-sm text-ink-muted">No store is linked to this account.</p>;
  }

  const waiting = items.filter((i) => !i.response);
  const missed = demand
    .filter((d) => d.out_of_stock_count > 0)
    .sort((a, b) => b.out_of_stock_count - a.out_of_stock_count)
    .slice(0, 5);
  const top = [...demand].sort((a, b) => b.request_count - a.request_count).slice(0, 5);
  const rate =
    metrics.requests_today > 0
      ? `${Math.round((metrics.answered_today / metrics.requests_today) * 1000) / 10}%`
      : "—";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-muted">{greetingForHour()}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{storeName || "Store"}</h1>
        {openLabel ? (
          <p className="mt-1 text-sm text-ink-muted">{openLabel}</p>
        ) : null}
      </div>

      {!hubConnected ? (
        <div className="rounded-2xl border border-hairline-strong bg-white px-4 py-4 sm:px-5">
          <p className="text-sm font-semibold text-ink">Open your store</p>
          <p className="mt-1 text-sm text-ink-muted">
            FINDIT accepted you. Connect a counter tablet, invite staff, and
            confirm hours so you can answer Asks.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href="/store/hub"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#E5231B] px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Connect FINDIT Hub
            </Link>
            <Link
              href="/store/team"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-hairline-strong px-4 py-2 text-center text-sm font-semibold text-ink"
            >
              Invite staff
            </Link>
            <Link
              href="/store/settings"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-hairline-strong px-4 py-2 text-center text-sm font-semibold text-ink"
            >
              Store profile
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Waiting"
          value={metrics.waiting_today}
          hint={`${metrics.requests_today} received today`}
        />
        <MetricCard
          label="Answered today"
          value={metrics.answered_today}
          hint={delta(metrics.answered_today, metrics.answered_yesterday)}
        />
        <MetricCard label="Response rate" value={rate} hint="Today, this location" />
        <MetricCard
          label="Avg response time"
          value={
            metrics.avg_response_minutes != null
              ? formatDurationSeconds(metrics.avg_response_minutes * 60)
              : "—"
          }
          hint={`${metrics.week_customer_finds} potential customers found this week`}
        />
      </div>

      {waiting.length ? (
        <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-[#E5231B]/20 bg-[#FFF1F0] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-sm font-semibold text-[#C81109]">
              {waiting.length} request{waiting.length === 1 ? "" : "s"} waiting
            </p>
            <p className="text-xs text-ink-muted">Unanswered asks for this store.</p>
          </div>
          <Link
            href="/store/requests"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#E5231B] px-4 py-2 text-center text-sm font-semibold text-white"
          >
            View requests
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Recent requests"
          action={
            <Link href="/store/requests" className="text-xs font-medium text-ink-muted hover:text-ink">
              View all
            </Link>
          }
        >
          {items.length === 0 ? (
            <p className="text-sm text-ink-muted">No requests in the last 7 days.</p>
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {items.slice(0, 8).map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/store/requests/${row.id}`}
                    className="flex items-center justify-between gap-3 py-3 text-sm hover:text-[#C81109]"
                  >
                    <span className="truncate font-medium">{row.product_name}</span>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {row.response?.response_type?.replace("_", " ") || "Waiting"} ·{" "}
                      {formatRelativeTime(row.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Demand snapshot">
          {top.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Not enough data yet. Insights appear after nearby customers start asking.
            </p>
          ) : (
            <ol className="space-y-3 text-sm">
              {top.map((item, i) => (
                <li key={item.normalized_product_name} className="flex justify-between gap-3">
                  <span>
                    {i + 1}. {item.product_name}
                  </span>
                  <span className="tabular-nums text-ink-muted">{item.request_count}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel title="Missed opportunities">
        {missed.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No repeated out-of-stock patterns yet. This fills in as you answer asks.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {missed.map((item) => (
              <li key={item.normalized_product_name} className="flex justify-between gap-3">
                <span>{item.product_name}</span>
                <span className="text-ink-muted">
                  {item.request_count} asks · {item.out_of_stock_count} out of stock
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default function StoreHomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"loading" | "owner" | "employee">("loading");

  useEffect(() => {
    getStoreWorkspaceAction().then((ws) => {
      if (ws?.canManageStore) {
        setMode("owner");
        return;
      }
      setMode("employee");
      router.replace("/store/hub");
    });
  }, [router]);

  if (mode === "loading" || mode === "employee") {
    return <Skeleton className="h-40" />;
  }
  return <OwnerOverview />;
}
