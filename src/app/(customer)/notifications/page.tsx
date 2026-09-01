"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import {
  getNotificationsAction,
  markNotificationReadAction,
} from "@/lib/services/actions";
import {
  browserNotifyPermission,
  requestBrowserNotifyPermission,
} from "@/lib/browser-notify";
import { subscribeWebPush } from "@/lib/web-push-client";
import { canRequestWebPush } from "@/lib/pwa";
import { formatRelativeTime } from "@/lib/utils";
import type { Notification } from "@/types/database";

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | "unsupported">(
    "default"
  );

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

  async function enableBrowserAlerts() {
    if (!canRequestWebPush()) {
      toast.message(
        "Add FINDIT to your Home Screen first. Then open FINDIT there to enable notifications."
      );
      return;
    }
    const next = await requestBrowserNotifyPermission();
    setBrowserPermission(next);
    if (next !== "granted") {
      toast.message("You can still see alerts here.");
      return;
    }
    const subscribed = await subscribeWebPush();
    if (subscribed.ok) {
      toast.success("We’ll ping this phone even after you close FINDIT.");
    } else if (subscribed.error === "ios-homescreen") {
      toast.message("Add FINDIT to your Home Screen to get alerts after you close it.");
    } else {
      toast.message("Couldn’t turn on lock-screen alerts. You can still see replies here.");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Alerts</h1>
      {browserPermission === "default" ? (
        <div className="mt-4">
          <Button type="button" variant="outline" className="w-full" onClick={enableBrowserAlerts}>
            Allow notifications
          </Button>
        </div>
      ) : null}
      {browserPermission === "granted" ? (
        <p className="mt-3 text-sm text-ink-subtle">Browser alerts are on for this device.</p>
      ) : null}
      {browserPermission === "denied" ? (
        <p className="mt-3 text-sm text-ink-muted">
          Notifications are off. Enable them in your device or browser settings to
          receive store responses.
        </p>
      ) : null}
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
