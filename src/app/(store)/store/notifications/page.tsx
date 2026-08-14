"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { BackLink } from "@/components/shared/app-header";
import {
  getNotificationsAction,
  markNotificationReadAction,
} from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";
import type { Notification } from "@/types/database";

export default function StoreNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await getNotificationsAction();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="px-5 pt-6 md:px-8 md:pt-8">
      <BackLink href="/store" label="Store home" className="mb-2 md:hidden" />
      <h1 className="text-2xl font-bold tracking-tight text-ink">Notifications</h1>
      <p className="mt-1 text-sm text-ink-muted">
        New customer asks and status updates for your store.
      </p>
      <div className="mt-6 space-y-3">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : items.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            description="When customers ask near your store, alerts show up here."
            action={
              <Link
                href="/store"
                className="text-sm font-semibold text-accent-ink underline underline-offset-2"
              >
                Open request inbox
              </Link>
            }
          />
        ) : (
          items.map((n) => (
            <Link
              key={n.id}
              href={n.related_request_id ? `/store` : "/store"}
              className="block w-full text-left"
              onClick={() => {
                void markNotificationReadAction(n.id);
              }}
            >
              <Card interactive className="p-4">
                <p className="font-semibold text-ink">{n.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{n.body}</p>
                <p className="mt-2 text-xs text-ink-subtle">
                  {formatRelativeTime(n.created_at)}
                </p>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
