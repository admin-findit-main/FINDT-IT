"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, MessageCircle, ShoppingBag } from "lucide-react";
import {
  getHubHistoryAction,
  type HubHistoryItem,
} from "@/lib/services/loyalty";
import { formatRelativeTime } from "@/lib/utils";

type Filter = "all" | "customers" | "requests";

function responseLabel(type: Extract<HubHistoryItem, { kind: "request_answer" }>["responseType"]) {
  if (type === "in_stock") return "In Stock";
  if (type === "out_of_stock") return "Out of Stock";
  if (type === "can_order") return "Can Order";
  return "Not Relevant";
}

export function HubHistoryWorkspace({
  refreshKey,
}: {
  refreshKey: number;
}) {
  const [rows, setRows] = useState<HubHistoryItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRefreshKey = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getHubHistoryAction();
    setLoading(false);
    if (result.error) {
      setRows([]);
      setError("We couldn’t load history. Try again.");
      return;
    }
    setRows(result.rows);
  }, []);

  useEffect(() => {
    if (loadedRefreshKey.current === refreshKey) return;
    loadedRefreshKey.current = refreshKey;
    void load();
  }, [load, refreshKey]);

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (filter === "customers") return row.kind === "purchase";
        if (filter === "requests") return row.kind === "request_answer";
        return true;
      }),
    [rows, filter]
  );

  return (
    <section className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-6 py-8 md:px-10 md:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#7A1D28]">
        History
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#171315]">
        Recent activity
      </h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["customers", "Customers"],
            ["requests", "Requests"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`min-h-11 rounded-xl px-5 text-sm font-semibold ${
              filter === value
                ? "bg-[#171315] text-white"
                : "border border-[#D8D1D4] bg-white text-[#5F585B]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded-xl bg-[#EAE5E7]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-[#E3C9CD] bg-white p-6">
          <p className="text-[#8E1F2D]">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 min-h-12 rounded-xl bg-[#171315] px-5 text-sm font-bold text-white"
          >
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-6 flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-[#CEC7CA] bg-white text-center">
          <div>
            <Clock3 className="mx-auto h-8 w-8 text-[#A69DA0]" />
            <p className="mt-3 font-semibold text-[#413B3E]">
              No recent activity.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-[#E8E3E5] overflow-hidden rounded-2xl border border-[#DED9DB] bg-white">
          {visible.map((row, index) => {
            const purchase = row.kind === "purchase";
            return (
              <li
                key={`${row.kind}-${row.timestamp}-${index}`}
                className="flex min-h-20 items-center gap-4 px-5 py-4"
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                    purchase
                      ? "bg-[#F8EEF0] text-[#8E1F2D]"
                      : "bg-[#EEF1F5] text-[#343C4A]"
                  }`}
                >
                  {purchase ? (
                    <ShoppingBag className="h-5 w-5" />
                  ) : (
                    <MessageCircle className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#171315]">
                    {purchase
                      ? row.status === "reversed"
                        ? "Customer purchase reversed"
                        : "Customer purchase confirmed"
                      : `Request answered: ${responseLabel(row.responseType)}`}
                  </p>
                  <p className="mt-1 truncate text-sm text-[#6D6669]">
                    {purchase
                      ? `${row.customerFirstName}${row.productName ? ` · ${row.productName}` : ""}`
                      : row.productName}
                    {row.employeeDisplayName
                      ? ` · ${row.employeeDisplayName}`
                      : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {purchase ? (
                    <p className="font-bold text-[#8E1F2D]">
                      {row.status === "reversed"
                        ? "Reversed"
                        : `+${row.points} points`}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-[#81797C]">
                    {formatRelativeTime(row.timestamp)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
