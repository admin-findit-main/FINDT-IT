"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { GlassSelect } from "@/components/ui/glass";
import {
  getStoreCustomersAction,
  type StoreCustomerRow,
  type StoreCustomerSort,
  type StoreCustomerVisitFilter,
} from "@/lib/services/loyalty";
import { formatRelativeTime, cn } from "@/lib/utils";

const VISIT_FILTERS: { id: StoreCustomerVisitFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "recent_7", label: "Visited · 7d" },
  { id: "recent_30", label: "Visited · 30d" },
  { id: "inactive_17", label: "Away · 17d+" },
  { id: "inactive_30", label: "Away · 30d+" },
  { id: "inactive_60", label: "Away · 60d+" },
  { id: "birthday_month", label: "Birthdays · this month" },
];

const SORTS: { id: StoreCustomerSort; label: string }[] = [
  { id: "last_seen_desc", label: "Last visited · newest" },
  { id: "last_seen_asc", label: "Last visited · oldest" },
  { id: "points_desc", label: "Most points" },
  { id: "purchases_desc", label: "Most purchases" },
];

export function StoreCustomersDirectory({
  initialRows,
  initialNextCursor,
  storeName,
}: {
  initialRows: StoreCustomerRow[];
  initialNextCursor: string | null;
  storeName: string;
}) {
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q.trim());
  const [visit, setVisit] = useState<StoreCustomerVisitFilter>("all");
  const [sort, setSort] = useState<StoreCustomerSort>("last_seen_desc");
  const [rows, setRows] = useState(initialRows);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const result = await getStoreCustomersAction({
        q: deferredQ,
        visit,
        sort,
      });
      if (cancelled) return;
      if ("error" in result && result.error) {
        setError(result.error);
        setRows([]);
        setNextCursor(null);
        return;
      }
      setError(null);
      setRows(result.rows);
      setNextCursor(result.nextCursor);
    });
    return () => {
      cancelled = true;
    };
  }, [deferredQ, visit, sort]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await getStoreCustomersAction({
      q: deferredQ,
      visit,
      sort,
      cursor: nextCursor,
    });
    setLoadingMore(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    setRows((prev) => {
      const seen = new Set(prev.map((row) => row.id));
      return [...prev, ...result.rows.filter((row) => !seen.has(row.id))];
    });
    setNextCursor(result.nextCursor);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Look up a ${storeName} customer by name`}
          className="pl-9"
          aria-label="Search customers by name"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {VISIT_FILTERS.map((filter) => {
          const active = visit === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setVisit(filter.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-[var(--fd-black)] bg-[var(--fd-black)] text-ink-inverse"
                  : "border-hairline-strong bg-white text-ink-muted hover:text-ink"
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">
          {pending ? "Updating…" : `${rows.length} customer${rows.length === 1 ? "" : "s"}`}
          {visit === "inactive_17" ? " · haven’t visited in 17+ days" : null}
        </p>
        <GlassSelect
          aria-label="Sort customers"
          className="h-10 w-auto min-w-[11rem] px-3 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as StoreCustomerSort)}
        >
          {SORTS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </GlassSelect>
      </div>

      {error ? <p className="text-sm text-ink-muted">{error}</p> : null}

      {!error && rows.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {deferredQ || visit !== "all"
            ? "No customers match that lookup or filter."
            : "No customers yet. They show up after a Hub purchase."}
        </p>
      ) : (
        <ul className="divide-y divide-black/[0.06]">
          {rows.map((customer) => (
            <li
              key={customer.id}
              className="grid gap-2 py-3.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto]"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{customer.displayName}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Last visited {formatRelativeTime(customer.lastSeenAt)}
                  {customer.daysSinceVisit > 0
                    ? ` · ${customer.daysSinceVisit}d ago`
                    : " · today"}
                  {customer.birthdayLabel
                    ? ` · Birthday ${customer.birthdayLabel}${
                        customer.birthdayThisMonth ? " · this month" : ""
                      }`
                    : ""}
                  {customer.marketingOptIn ? " · Promo opt-in" : ""}
                </p>
              </div>
              <p className="tabular-nums text-ink-muted sm:text-right">
                {customer.confirmedPurchases} purchase
                {customer.confirmedPurchases === 1 ? "" : "s"}
              </p>
              <p className="min-w-20 font-semibold tabular-nums sm:text-right">
                {customer.pointsBalance} pts
              </p>
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <div className="flex justify-end pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
