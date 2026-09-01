"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassBadge } from "@/components/ui/glass";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { getCustomerRequestsAction } from "@/lib/services/actions";
import { readCached, writeCached } from "@/lib/data/client-cache";
import { formatRelativeTime } from "@/lib/utils";
import { formatShortPlace } from "@findit/domain";
import type { CustomerRequest } from "@/types/database";

type RequestsTab = "active" | "past" | "saved";

function tabFromParam(value: string | null): RequestsTab {
  if (value === "past" || value === "saved" || value === "active") return value;
  return "active";
}

export default function RequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<RequestsTab>(() =>
    tabFromParam(searchParams.get("tab"))
  );
  const [items, setItems] = useState<CustomerRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTab(tabFromParam(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    const cached = readCached<CustomerRequest[]>(`requests:${tab}`, 60_000);
    if (cached) {
      setItems(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    getCustomerRequestsAction(tab).then((data) => {
      setItems(data);
      writeCached(`requests:${tab}`, data);
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
            onClick={() => {
              setTab(t);
              router.replace(t === "active" ? "/requests" : `/requests?tab=${t}`);
            }}
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
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title={
              tab === "saved"
                ? "Nothing saved yet"
                : tab === "past"
                  ? "No completed requests yet"
                  : "No requests yet"
            }
            description={
              tab === "saved"
                ? "Open a request and save it to find it here later."
                : tab === "past"
                  ? "Finished requests will appear here."
                  : "Your requests will appear here."
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
