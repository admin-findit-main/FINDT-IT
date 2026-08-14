"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import {
  getNotificationsAction,
  markNotificationReadAction,
} from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";
import type { Notification } from "@/types/database";

export default function NotificationsPage() {
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
    <div className="px-5 pt-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Notifications</h1>
      <div className="mt-6 space-y-3">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : items.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            description="Store replies and request updates will appear here."
          />
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              type="button"
              className="block w-full text-left"
              onClick={async () => {
                await markNotificationReadAction(n.id);
                load();
              }}
            >
              <Card
                interactive
                level={n.read_at ? "subtle" : "base"}
                className={`p-4 ${n.read_at ? "opacity-75" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{n.title}</p>
                    <p className="mt-1 text-sm text-ink-muted">{n.body}</p>
                    <p className="mt-2 text-xs text-ink-muted">
                      {formatRelativeTime(n.created_at)}
                    </p>
                  </div>
                  {!n.read_at ? (
                    <span
                      aria-hidden
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent shadow-accent"
                    />
                  ) : null}
                </div>
                {n.related_request_id ? (
                  <Link
                    href={`/requests/${n.related_request_id}`}
                    className="mt-3 inline-block text-sm font-semibold text-accent-ink underline underline-offset-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View request
                  </Link>
                ) : null}
              </Card>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
