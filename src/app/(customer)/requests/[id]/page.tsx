"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassBadge, GlassNotice } from "@/components/ui/glass";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { BackLink } from "@/components/shared/app-header";
import { ResponseAccent, StatusBadge } from "@/components/shared/status";
import { NotificationPrompt } from "@/components/customer/notification-prompt";
import {
  cancelRequestAction,
  fulfillRequestAction,
  getCustomerRequestAction,
  saveRequestAction,
  stillLookingAction,
  submitPilotFeedbackAction,
  trackDirectionsClickAction,
} from "@/lib/services/actions";
import { useRequestRealtime } from "@/lib/supabase/realtime";
import { formatDurationSeconds } from "@/lib/services/request-lifecycle";
import {
  formatExpiresIn,
  formatPrice,
  formatRelativeTime,
  isRequestExpired,
  mapsDirectionsUrl,
} from "@/lib/utils";
import {
  estimateRoutingDistanceMiles,
  formatEstimatedDistanceMiles,
  formatShortPlace,
  sortCustomerResponsesByDistance,
} from "@findit/domain";
import type { CustomerRequest, Store, StoreResponse } from "@/types/database";
import { toast } from "sonner";

type Detail = CustomerRequest & {
  responses?: (StoreResponse & { store?: Store })[];
  targets_count?: number;
};

const STORES_PAGE_SIZE = 5;

function SearchingStoresCard({
  storesContacted,
  placeLabel,
  expiresAt,
}: {
  storesContacted: number;
  placeLabel: string;
  expiresAt: string;
}) {
  return (
    <Card className="mt-4 p-6 text-center">
      <div className="flex items-center justify-center gap-2" aria-hidden>
        <span className="findit-search-dot h-2.5 w-2.5 rounded-full bg-accent" />
        <span
          className="findit-search-dot h-2.5 w-2.5 rounded-full bg-accent"
          style={{ animationDelay: "0.2s" }}
        />
        <span
          className="findit-search-dot h-2.5 w-2.5 rounded-full bg-accent"
          style={{ animationDelay: "0.4s" }}
        />
      </div>
      <h2 className="mt-4 text-xl font-bold tracking-tight text-ink">
        Asking nearby stores
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Sent to {storesContacted} store{storesContacted === 1 ? "" : "s"}
        {placeLabel ? ` near ${placeLabel}` : ""}. Answers will show up here,
        closest first.
      </p>
      <p className="mt-3 text-xs text-ink-subtle">{formatExpiresIn(expiresAt)}</p>
      <NotificationPrompt compact waiting className="mt-5 text-left" />
    </Card>
  );
}

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [foundStep, setFoundStep] = useState<"idle" | "ask" | "done">("idle");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [visibleStoreCount, setVisibleStoreCount] = useState(STORES_PAGE_SIZE);

  const load = useCallback(async () => {
    const result = await getCustomerRequestAction(params.id);
    setData(result);
    setLoading(false);
    if (result?.status === "fulfilled") setFoundStep("done");
  }, [params.id]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 20000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    setVisibleStoreCount(STORES_PAGE_SIZE);
  }, [params.id]);

  useRequestRealtime(params.id, { onChange: load });

  const expired = useMemo(
    () => (data ? isRequestExpired(data.expires_at, data.status) : false),
    [data]
  );

  const responses = useMemo(
    () =>
      sortCustomerResponsesByDistance(
        (data?.responses || []).filter((r) => r.response_type !== "not_relevant"),
        data?.postal_code || "",
        data?.city,
        { latitude: data?.latitude, longitude: data?.longitude }
      ),
    [data]
  );

  const visibleResponses = responses.slice(0, visibleStoreCount);
  const hiddenStoreCount = Math.max(0, responses.length - visibleStoreCount);
  const storesContacted = data?.stores_targeted || data?.targets_count || 0;
  const openRequest =
    !expired &&
    data?.status !== "cancelled" &&
    data?.status !== "fulfilled";
  const searching = Boolean(openRequest && responses.length === 0 && storesContacted > 0);
  const waitingOnMore = Boolean(
    openRequest && responses.length > 0 && storesContacted > responses.length
  );

  const placeLabel = data
    ? formatShortPlace({
        city: data.city,
        state: data.state,
        postalCode: data.postal_code,
      })
    : "";

  async function markFound(storeId?: string | null) {
    setSelectedStoreId(storeId || null);
    setFoundStep("ask");
  }

  async function confirmFound(foundWithFindit: boolean | null) {
    if (!data) return;
    const result = await fulfillRequestAction({
      requestId: data.id,
      storeId: selectedStoreId,
      foundWithFindit,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Marked as found");
    setFoundStep("done");
    load();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-5 py-8 sm:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-5 py-8 sm:px-8">
        <BackLink href="/requests" label="Back to requests" />
        <div className="mt-4">
          <EmptyState
            title="Request not found"
            description="It may have been removed."
          />
        </div>
        <p className="mt-4 text-center text-sm">
          <Link
            href="/requests"
            className="font-semibold text-accent-ink underline underline-offset-2"
          >
            Back to your requests
          </Link>
        </p>
      </div>
    );
  }

  const headline =
    data.status === "fulfilled"
      ? "Found"
      : expired
        ? "Expired request"
        : data.status === "cancelled"
          ? "Cancelled"
          : searching
            ? "Asking nearby stores"
            : responses.length
              ? "Stores answered · closest first"
              : "Searching nearby stores…";

  return (
    <div className="mx-auto max-w-xl px-5 py-6 pb-12 sm:px-8">
      <div className="mb-2">
        <BackLink href="/requests" label="Back to requests" />
      </div>
      <p className="text-sm font-medium text-ink-muted">{headline}</p>
      <Card className="mt-4 overflow-hidden p-5 sm:p-6">
        {data.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.image_url}
            alt=""
            className="mb-4 h-40 w-full rounded-glass-lg border border-hairline-strong object-cover"
          />
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {data.product_name}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {placeLabel || "ZIP not set"} · Requested {formatRelativeTime(data.created_at)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge
            type={
              data.status === "fulfilled"
                ? "in_stock"
                : responses.some((r) => r.response_type === "in_stock")
                  ? "in_stock"
                  : responses.length
                    ? "can_order"
                    : "pending"
            }
          />
          <span className="text-sm text-ink-muted">
            {data.status === "fulfilled"
              ? "You found it"
              : expired
                ? "This request has expired."
                : data.status === "cancelled"
                  ? "Cancelled"
                  : searching
                    ? "Waiting for stores"
                    : responses.length
                      ? `${responses.length} store${responses.length === 1 ? "" : "s"} answered`
                      : "Waiting for stores"}
          </span>
        </div>
        {!searching ? (
          <p className="mt-3 text-sm text-ink-muted">
            Sent to {storesContacted} nearby store{storesContacted === 1 ? "" : "s"}
          </p>
        ) : null}
        {!expired && data.status !== "cancelled" && data.status !== "fulfilled" && !searching ? (
          <p className="mt-1 text-xs text-ink-muted">
            {formatExpiresIn(data.expires_at)}
          </p>
        ) : null}
      </Card>

      {storesContacted === 0 ? (
        <GlassNotice tone="muted" className="mt-4">
          <h2 className="font-semibold text-ink">
            We don&apos;t have enough participating stores in this area yet.
          </h2>
          <p className="mt-2">
            We saved this location demand. You can try a nearby ZIP or check back soon.
          </p>
        </GlassNotice>
      ) : null}

      {searching ? (
        <SearchingStoresCard
          storesContacted={storesContacted}
          placeLabel={placeLabel}
          expiresAt={data.expires_at}
        />
      ) : (
        <div className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                {responses.length ? "Stores that answered" : "Responses"}
              </h2>
              {responses.length ? (
                <p className="mt-1 text-sm text-ink-muted">Closest first</p>
              ) : null}
            </div>
            {waitingOnMore ? (
              <p className="text-xs font-medium text-ink-subtle">Waiting on more…</p>
            ) : null}
          </div>
          {waitingOnMore ? (
            <div className="mt-4">
              <NotificationPrompt compact waiting />
            </div>
          ) : null}
          {responses.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title={
                  storesContacted === 0
                    ? "No participating stores nearby yet."
                    : "No replies yet."
                }
                description={
                  storesContacted === 0
                    ? "We saved this ask. Try another ZIP, or check back as more stores join."
                    : "Replies show up here as stores answer, closest first."
                }
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {visibleResponses.map((response) => {
                const store = response.store;
                if (!store) return null;
                const muted = response.response_type === "out_of_stock";
                const responseSecs = Math.round(
                  (new Date(response.created_at).getTime() -
                    new Date(data.created_at).getTime()) /
                    1000
                );
                const miles = estimateRoutingDistanceMiles({
                  customerZip: data.postal_code,
                  storeZip: store.postal_code,
                  customerCity: data.city,
                  storeCity: store.city,
                  customerLatitude: data.latitude,
                  customerLongitude: data.longitude,
                  storeLatitude: store.latitude,
                  storeLongitude: store.longitude,
                });
                const canVisit = response.response_type !== "out_of_stock";
                const canMarkFound =
                  data.status !== "fulfilled" && response.response_type !== "out_of_stock";
                return (
                  <Card
                    key={response.id}
                    className={`relative overflow-hidden p-5 pl-6 ${muted ? "opacity-75" : ""}`}
                  >
                    <ResponseAccent type={response.response_type} />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{store.name}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                          <span className="inline-flex items-center gap-1 font-medium text-ink">
                            <MapPin className="h-3 w-3" aria-hidden />
                            {formatEstimatedDistanceMiles(miles)}
                          </span>
                          <span>· {store.postal_code}</span>
                        </p>
                        <div className="mt-2">
                          <StatusBadge type={response.response_type} />
                        </div>
                      </div>
                      {store.is_verified ? (
                        <GlassBadge className="shrink-0 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
                          Verified
                        </GlassBadge>
                      ) : null}
                    </div>
                    {formatPrice(response.price) ? (
                      <p className="mt-3 text-lg font-semibold text-ink">
                        {formatPrice(response.price)}
                      </p>
                    ) : null}
                    {response.availability_amount ? (
                      <p className="mt-1 text-sm capitalize text-ink-muted">
                        {response.availability_amount.replace("_", " ")}
                      </p>
                    ) : null}
                    {response.estimated_availability_label ? (
                      <p className="mt-1 text-sm text-ink-muted">
                        Available {response.estimated_availability_label.toLowerCase()}
                      </p>
                    ) : null}
                    {response.note ? (
                      <p className="mt-2 text-sm italic text-ink-muted">
                        “{response.note}”
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-ink-muted">
                      Responded {formatRelativeTime(response.updated_at)} ·{" "}
                      {formatDurationSeconds(responseSecs)}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className={canVisit ? "w-full" : "col-span-2 w-full"}
                      >
                        <Link href={`/stores/${store.slug}`}>View store</Link>
                      </Button>
                      {canVisit ? (
                        <Button asChild size="lg" variant="secondary" className="w-full">
                          <a
                            href={mapsDirectionsUrl(store)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() =>
                              trackDirectionsClickAction(data.id, store.id)
                            }
                          >
                            Directions
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ) : null}
                      {canMarkFound ? (
                        <Button
                          size="lg"
                          className="col-span-2 w-full"
                          onClick={() => markFound(store.id)}
                        >
                          I found it here
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
              {hiddenStoreCount > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() =>
                    setVisibleStoreCount((count) => count + STORES_PAGE_SIZE)
                  }
                >
                  Show more stores
                </Button>
              ) : null}
            </div>
          )}
        </div>
      )}

      {foundStep === "ask" ? (
        <Card level="strong" className="mt-6 p-5">
          <p className="font-semibold text-ink">
            Did FINDIT help you find this product?
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button size="lg" className="w-full" onClick={() => confirmFound(true)}>
              YES
            </Button>
            <Button
              size="lg"
              className="w-full"
              variant="outline"
              onClick={() => confirmFound(false)}
            >
              NOT YET
            </Button>
          </div>
        </Card>
      ) : null}

      {foundStep === "done" && !feedbackDone ? (
        <Card level="subtle" className="mt-6 p-5">
          <p className="font-semibold text-ink">
            Was this request experience helpful?
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              size="lg"
              className="w-full"
              variant="outline"
              onClick={async () => {
                await submitPilotFeedbackAction({
                  role: "customer",
                  requestId: data.id,
                  storeId: selectedStoreId || data.fulfilled_store_id || undefined,
                  helpful: true,
                });
                setFeedbackDone(true);
                toast.success("Thanks for the feedback");
              }}
            >
              Yes
            </Button>
            <Button
              size="lg"
              className="w-full"
              variant="ghost"
              onClick={async () => {
                await submitPilotFeedbackAction({
                  role: "customer",
                  requestId: data.id,
                  helpful: false,
                });
                setFeedbackDone(true);
                toast.success("Thanks — we’ll keep improving");
              }}
            >
              Not really
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="mt-8 space-y-3">
        {!expired &&
        data.status !== "cancelled" &&
        data.status !== "fulfilled" ? (
          <>
            <Button
              size="lg"
              className="w-full"
              onClick={() => markFound(responses.find((r) => r.response_type === "in_stock")?.store_id)}
            >
              I found it
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={async () => {
                const result = await stillLookingAction(data.id);
                if ("error" in result && result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Stores notified you’re still looking");
                load();
              }}
            >
              Still looking
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={async () => {
                  await saveRequestAction(data.id);
                  toast.success("Saved");
                }}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="w-full text-accent-ink hover:text-accent"
                onClick={async () => {
                  await cancelRequestAction(data.id);
                  toast.success("Cancelled. This still counts as one of your Finds this month.");
                  load();
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={async () => {
              await saveRequestAction(data.id);
              toast.success("Saved");
            }}
          >
            Save
          </Button>
        )}
      </div>
    </div>
  );
}
