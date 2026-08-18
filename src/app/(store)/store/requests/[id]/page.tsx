"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/dashboard/shell";
import { Skeleton } from "@/components/ui/primitives";
import { estimateZipDistanceMiles, isAgeRestrictedFind } from "@findit/domain";
import {
  getStoreIncomingRequestsAction,
  getStoreWorkspaceAction,
} from "@/lib/services/actions";
import { formatDurationSeconds } from "@/lib/services/request-lifecycle";
import { formatRelativeTime } from "@/lib/utils";
import type { CustomerRequest, Store, StoreResponse } from "@/types/database";

type Incoming = CustomerRequest & { response: StoreResponse | null };

export default function StoreRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<Incoming | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ws = await getStoreWorkspaceAction();
      const id = ws?.store?.id;
      if (!id) {
        setLoading(false);
        return;
      }
      setStore(ws.store);
      const list = await getStoreIncomingRequestsAction(id, "all", "30d");
      setRow((list as Incoming[]).find((r) => r.id === params.id) || null);
      setLoading(false);
    })();
  }, [params.id]);

  const miles = useMemo(() => {
    if (!store || !row) return null;
    return estimateZipDistanceMiles(row.postal_code, store.postal_code, store.city, row.city);
  }, [store, row]);

  if (loading) return <Skeleton className="h-64" />;
  if (!row) {
    return (
      <p className="text-sm text-ink-muted">
        This request is not assigned to your store.{" "}
        <Link href="/store/requests" className="underline">
          Back to requests
        </Link>
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/store/requests" className="text-sm text-ink-muted hover:text-ink">
        ← Requests
      </Link>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">Product</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">{row.product_name}</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {row.category ? `${row.category} · ` : ""}
          {formatRelativeTime(row.created_at)}
          {miles != null ? ` · ~${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi` : ""}
          {row.postal_code ? ` · ${row.city} ${row.postal_code}` : ""}
        </p>
        {isAgeRestrictedFind({
          category: row.category,
          productName: row.product_name,
          description: row.description,
        }) ? (
          <p className="mt-2 text-sm font-medium text-ink">
            Age-restricted — check a government ID at pickup.
          </p>
        ) : null}
      </div>
      {row.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.image_url} alt="" className="max-h-72 rounded-2xl object-cover" />
      ) : null}
      {row.description ? (
        <Panel title="Details">
          <p className="text-sm">{row.description}</p>
        </Panel>
      ) : null}
      <Panel title="Your store response">
        {row.response ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Status</dt>
              <dd className="font-medium capitalize">
                {row.response.response_type.replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Price</dt>
              <dd>{row.response.price != null ? `$${row.response.price}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Note</dt>
              <dd>{row.response.note || "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Response time</dt>
              <dd>
                {row.response.created_at
                  ? formatDurationSeconds(
                      Math.round(
                        (new Date(row.response.created_at).getTime() -
                          new Date(row.created_at).getTime()) /
                          1000
                      )
                    )
                  : "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-ink-muted">No response yet. Answer from Requests or FINDIT Hub.</p>
        )}
      </Panel>
    </div>
  );
}
