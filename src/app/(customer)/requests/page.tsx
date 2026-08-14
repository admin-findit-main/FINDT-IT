"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GlassBadge } from "@/components/ui/glass";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { getCustomerRequestsAction } from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";
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
    <div className="px-5 pt-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Your Requests</h1>
      <div className="glass-subtle mt-5 grid grid-cols-3 gap-1 rounded-glass-lg p-1">
        {(["active", "past", "saved"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`glass-press rounded-glass-md py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t
                ? "bg-glass-3 text-ink shadow-glass"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            title={
              tab === "saved"
                ? "No saved requests"
                : tab === "past"
                  ? "No past requests"
                  : "No active requests"
            }
            description={
              tab === "saved"
                ? "Open a request and save it to find it here later."
                : tab === "past"
                  ? "Fulfilled and expired asks show up here."
                  : "When you ask nearby stores for a product, it shows up here."
            }
          />
        ) : (
          items.map((item) => (
            <Link key={item.id} href={`/requests/${item.id}`} className="block">
              <Card interactive className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-ink">{item.product_name}</h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {item.city} · {formatRelativeTime(item.created_at)}
                    </p>
                  </div>
                  <GlassBadge className="shrink-0 capitalize">
                    {item.status.replace("_", " ")}
                  </GlassBadge>
                </div>
                <p className="mt-3 text-sm text-ink-muted">
                  Sent to {item.stores_targeted} stores
                </p>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
