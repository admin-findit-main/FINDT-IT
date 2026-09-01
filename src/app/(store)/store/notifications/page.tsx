"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { usePublicHref } from "@/components/host/host-surface";
import {
  getNotificationsAction,
  markNotificationReadAction,
} from "@/lib/services/actions";
import {
  browserNotifyPermission,
  requestBrowserNotifyPermission,
} from "@/lib/browser-notify";
import { subscribeWebPush } from "@/lib/web-push-client";
import { formatRelativeTime } from "@/lib/utils";
import type { Notification } from "@/types/database";

export default function StoreNotificationsPage() {
  const inboxHref = usePublicHref("/store");
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  async function load() {
    const data = await getNotificationsAction();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setBrowserPermission(browserNotifyPermission());
  }, []);

  async function enableAlerts() {
    const next = await requestBrowserNotifyPermission();
    setBrowserPermission(next);
    if (next !== "granted") {
      toast.message("You can still see alerts here.");
      return;
    }
    const subscribed = await subscribeWebPush();
    if (subscribed.ok) {
      toast.success("We’ll ping this phone when a shopper asks nearby.");
      return;
    }
    if (subscribed.error === "ios-homescreen") {
      toast.message(
        "Add FINDIT to your Home Screen, then allow alerts so they still arrive after you close it."
      );
      return;
    }
    toast.message("Couldn’t turn on lock-screen alerts. You can still see replies here.");
  }

  return (
    <div>
      <p className="text-sm text-ink-muted">
        New customer asks and status updates for your store.
      </p>
      {browserPermission === "default" ? (
        <div className="mt-4">
          <Button type="button" className="w-full sm:w-auto" onClick={() => void enableAlerts()}>
            Allow notifications
          </Button>
          <p className="mt-2 text-sm text-ink-muted">
            FINDIT will ask this browser for permission, then ping you when a nearby
            shopper asks — including after you close the tab.
          </p>
        </div>
      ) : null}
      {browserPermission === "granted" ? (
        <p className="mt-3 text-sm text-ink-subtle">
          Notifications are on for this device.
        </p>
      ) : null}
      {browserPermission === "denied" ? (
        <p className="mt-3 text-sm text-ink-muted">
          Notifications are blocked in this browser. Open site settings and allow
          alerts for askfindit.com, then reload.
        </p>
      ) : null}
      <div className="mt-6 space-y-3">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : items.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            description="When customers ask near your store, alerts show up here."
            action={
              <Link
                href={inboxHref}
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
              href={
                n.related_request_id
                  ? `/store/requests/${n.related_request_id}`
                  : inboxHref
              }
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
