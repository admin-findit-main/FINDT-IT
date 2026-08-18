"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import {
  getNotificationsAction,
  markNotificationReadAction,
} from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";
import type { Notification } from "@/types/database";

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await getNotificationsAction();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto max-w-xl px-5 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Alerts</h1>
      <div className="mt-6">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : items.length === 0 ? (
          <EmptyState
            title="No alerts yet."
            description="When a store answers, it shows up here."
          />
        ) : (
          <Card padded={false} className="overflow-hidden">
            {items.map((n, i) => (
              <button
                key={n.id}
                type="button"
                className={`flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-black/[0.03] ${
                  i < items.length - 1 ? "border-b border-hairline-strong" : ""
                }`}
                onClick={async () => {
                  await markNotificationReadAction(n.id);
                  if (n.related_request_id) {
                    router.push(`/requests/${n.related_request_id}`);
                    return;
                  }
                  load();
                }}
              >
                <span
                  aria-hidden
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    n.read_at ? "bg-transparent" : "bg-ink"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{n.title}</span>
                  <span className="mt-1 block text-sm text-ink-muted">{n.body}</span>
                  <span className="mt-2 block text-xs text-ink-subtle">
                    {formatRelativeTime(n.created_at)}
                  </span>
                </span>
              </button>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
