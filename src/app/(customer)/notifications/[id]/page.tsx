"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import {
  getNotificationDetailAction,
  markNotificationReadAction,
} from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";
import type { Notification } from "@/types/database";

export default function NotificationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [note, setNote] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = String(params.id || "");
    if (!id) {
      setLoading(false);
      return;
    }
    void (async () => {
      const detail = await getNotificationDetailAction(id);
      setNote(detail);
      setLoading(false);
      if (detail && !detail.read_at) {
        await markNotificationReadAction(detail.id);
      }
    })();
  }, [params.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-5 py-8 sm:px-8">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="mx-auto max-w-xl px-5 py-8 sm:px-8">
        <p className="text-sm text-ink-muted">That alert wasn’t found.</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/notifications")}
        >
          Back to alerts
        </Button>
      </div>
    );
  }

  const store = note.store;
  const address = store
    ? [
        store.street_address,
        [store.city, store.state].filter(Boolean).join(", "),
        store.postal_code,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="mx-auto max-w-xl px-5 py-8 pb-12 sm:px-8">
      <button
        type="button"
        className="text-sm font-semibold text-ink-muted"
        onClick={() => router.push("/notifications")}
      >
        ← Alerts
      </button>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">
        {note.title}
      </h1>
      <p className="mt-2 text-xs text-ink-subtle">
        {formatRelativeTime(note.created_at)}
      </p>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
        {note.body}
      </p>

      {store ? (
        <Card className="mt-8 space-y-4 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Sent by this store
          </p>
          <div className="flex items-start gap-3">
            {store.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={store.logo_url}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-black/[0.05] text-sm font-bold text-ink">
                {store.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-ink">{store.name}</p>
              {address ? (
                <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-muted">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{address}</span>
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`/stores/${store.slug}`}>View store</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/rewards">Store rewards</Link>
            </Button>
          </div>
        </Card>
      ) : note.related_request_id ? (
        <Button
          type="button"
          className="mt-8"
          onClick={() => router.push(`/requests/${note.related_request_id}`)}
        >
          Open this Find
        </Button>
      ) : null}
    </div>
  );
}
