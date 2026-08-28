"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GlassBadge } from "@/components/ui/glass";
import { Card, EmptyState } from "@/components/ui/primitives";
import { FindProgress } from "@/components/shared/load-progress";
import { getCustomerRequestsAction } from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";
import { formatShortPlace } from "@findit/domain";
import type { CustomerRequest } from "@/types/database";

export default function RequestsPage() {
  const [tab, setTab] = useState<"active" | "past" | "saved">("active");
  const [items, setItems] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCustomerRequestsAction(tab).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, [tab]);

  return (
    <div className="mx-auto max-w-xl px-5 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Requests</h1>
      <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-[var(--solid-3)] p-1">
        {(
          [
            ["active", "Active"],
            ["past", "Completed"],
            ["saved", "Saved"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? "bg-white text-ink shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <FindProgress percent={36} label="Loading your Finds" />
        ) : items.length === 0 ? (
          <EmptyState
            title={
              tab === "saved"
                ? "Nothing saved yet."
                : tab === "past"
                  ? "Nothing completed yet."
                  : "No Finds yet."
            }
            description={
              tab === "saved"
                ? "Open a request and save it to find it here later."
                : tab === "past"
                  ? "Finished and expired Finds show up here."
                  : "Ask nearby stores from Find."
            }
          />
        ) : (
          <Card padded={false} className="overflow-hidden">
            {items.map((item, i) => (
              <Link
                key={item.id}
                href={`/requests/${item.id}`}
                className={`flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-black/[0.03] ${
                  i < items.length - 1 ? "border-b border-hairline-strong" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">
                    {item.product_name}
                  </span>
                  <span className="mt-0.5 block truncate text-sm capitalize text-ink-muted">
                    {item.status.replaceAll("_", " ")} ·{" "}
                    {formatShortPlace({
                      city: item.city,
                      state: item.state,
                      postalCode: item.postal_code,
                    })}
                    {" · "}
                    {formatRelativeTime(item.created_at)}
                  </span>
                </span>
                <GlassBadge className="shrink-0 capitalize">
                  {item.stores_targeted} asked
                </GlassBadge>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
