"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/dialog";
import { Card, EmptyState, Input, Label, Skeleton, Textarea } from "@/components/ui/primitives";
import {
  GlassCard,
  GlassChip,
  GlassNotice,
  GlassSelect,
  Overline,
  StatusRail,
  toneForResponse,
} from "@/components/ui/glass";
import { StatusBadge } from "@/components/shared/status";
import { AVAILABILITY_OPTIONS, HOLD_OPTIONS, STOCK_AMOUNT_OPTIONS, STORE_TRIAL_DAYS } from "@/lib/config/constants";
import {
  getCurrentProfile,
  getStoreIncomingRequestsAction,
  getStoreMetricsAction,
  getStoreWorkspaceAction,
  getUserStoresAction,
  markStoreRequestOpenedAction,
  respondToRequestAction,
} from "@/lib/services/actions";
import { useStoreInboxRealtime } from "@/lib/supabase/realtime";
import {
  displayName,
  formatExpiresIn,
  formatRelativeTime,
  greetingForHour,
} from "@/lib/utils";
import type { CustomerRequest, Profile, Store, StoreMetrics, StoreResponse } from "@/types/database";
import type { StoreWorkspace } from "@/lib/auth/store-role";

type Incoming = CustomerRequest & {
  response: StoreResponse | null;
};

export default function StoreDashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stores, setStores] = useState<(Store & { role: string })[]>([]);
  const [workspace, setWorkspace] = useState<StoreWorkspace | null>(null);
  const [storeId, setStoreId] = useState<string>("");
  const [metrics, setMetrics] = useState<StoreMetrics | null>(null);
  const [items, setItems] = useState<Incoming[]>([]);
  const [filter, setFilter] = useState("unanswered");
  const [range, setRange] = useState("today");
  const [loading, setLoading] = useState(true);
  const [managerNotice, setManagerNotice] = useState(false);

  const [sheet, setSheet] = useState<"in_stock" | "can_order" | "track" | null>(null);
  const [activeRequest, setActiveRequest] = useState<Incoming | null>(null);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [holdMinutes, setHoldMinutes] = useState<number | null>(null);
  const [availability, setAvailability] = useState("Tomorrow");
  const [stockAmount, setStockAmount] = useState<"plenty" | "few_left" | "last_one" | "">("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (sid = storeId) => {
    if (!sid) return;
    const [m, list] = await Promise.all([
      getStoreMetricsAction(sid),
      getStoreIncomingRequestsAction(sid, filter, range),
    ]);
    setMetrics(m);
    setItems(list);
    setLoading(false);
  }, [storeId, filter, range]);

  useEffect(() => {
    Promise.all([
      getCurrentProfile(),
      getUserStoresAction(),
      getStoreWorkspaceAction(),
    ]).then(([p, s, ws]) => {
      setProfile(p);
      setStores(s);
      setWorkspace(ws);
      if (s[0]) {
        setStoreId(s[0].id);
      } else {
        setLoading(false);
      }
    });
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("notice") === "manager") setManagerNotice(true);
    }
  }, []);

  useEffect(() => {
    if (storeId) {
      setLoading(true);
      load(storeId);
      const t = setInterval(() => load(storeId), 8000);
      return () => clearInterval(t);
    }
  }, [storeId, load]);

  useStoreInboxRealtime(storeId, { onChange: () => load(storeId) });

  async function respond(
    type: "in_stock" | "out_of_stock" | "can_order",
    request: Incoming | null = activeRequest,
    extra?: {
      price?: number | null;
      quantity?: number | null;
      note?: string;
      holdMinutes?: number | null;
      estimatedAvailabilityLabel?: string;
      availabilityAmount?: "plenty" | "few_left" | "last_one" | null;
      trackDemand?: boolean;
    }
  ) {
    if (!request || !storeId) return;
    setActiveRequest(request);
    setSubmitting(true);
    await markStoreRequestOpenedAction(storeId, request.id);
    const result = await respondToRequestAction({
      requestId: request.id,
      storeId,
      responseType: type,
      ...extra,
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      type === "in_stock"
        ? "Marked in stock — customer notified"
        : type === "can_order"
          ? "Sent to customer"
          : "Marked out of stock"
    );
    setSheet(null);
    if (type === "out_of_stock") {
      setSheet("track");
    } else {
      setActiveRequest(null);
      resetForm();
    }
    load();
  }

  function resetForm() {
    setPrice("");
    setQuantity("");
    setNote("");
    setHoldMinutes(null);
    setAvailability("Tomorrow");
    setStockAmount("");
  }

  const store = stores.find((s) => s.id === storeId);
  const canManage = workspace?.canManageStore ?? store?.role !== "employee";
  const isEmployee = !canManage;

  if (!loading && stores.length === 0) {
    return (
      <div className="px-5 pt-10 md:px-8">
        <EmptyState
          title="No store assigned yet"
          description="Owners apply their business on FINDIT. Staff join with an invite link from their owner — not the public apply form."
          action={
            <Button asChild>
              <Link href="/join">Apply your business</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 md:px-8 md:pt-8">
      {managerNotice ? (
        <GlassNotice tone="order" className="mb-4">
          That page is for owners and managers. Your job here is answering
          requests.
        </GlassNotice>
      ) : null}
      <header>
        <p className="text-sm text-ink-muted">
          {greetingForHour()}, {displayName(profile || {})}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {isEmployee ? "Answer requests" : "Store requests"}
          </h1>
          {stores.length > 1 ? (
            <GlassSelect
              aria-label="Select store"
              className="h-10 w-auto px-3 text-sm"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </GlassSelect>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          {isEmployee
            ? `${store?.name || "Your store"} · Tap In Stock, Out, or Can Order`
            : `${store?.name || "Your store"} · Answer quickly · ${STORE_TRIAL_DAYS} days free`}
        </p>
      </header>

      {canManage ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Requests Today", metrics?.requests_today],
              ["Answered", metrics?.answered_today],
              ["Waiting", metrics?.waiting_today],
              ["In Stock", metrics?.in_stock_today],
            ].map(([label, value]) => (
              <Card key={String(label)} className="p-4">
                <Overline>{label}</Overline>
                <p className="mt-2 text-2xl font-bold text-ink">{value ?? "—"}</p>
              </Card>
            ))}
          </div>

          <Card sheen className="mt-4 p-5 sm:p-6">
            <Overline>This week</Overline>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              {[
                [metrics?.week_received ?? "—", "requests"],
                [metrics?.week_answered ?? "—", "answered"],
                [
                  metrics?.week_response_rate != null
                    ? `${metrics.week_response_rate}%`
                    : "—",
                  "response rate",
                ],
                [
                  metrics?.week_avg_response_minutes != null
                    ? `${metrics.week_avg_response_minutes}m`
                    : "—",
                  "avg response",
                ],
                [metrics?.week_customer_finds ?? "—", "customer finds"],
              ].map(([value, label]) => (
                <div
                  key={String(label)}
                  className="glass-subtle rounded-glass-lg px-3 py-2.5"
                >
                  <p className="text-2xl font-bold text-ink">{value}</p>
                  <p className="text-ink-muted">{label}</p>
                </div>
              ))}
            </div>
            {store?.trial_ends_at ? (
              <GlassNotice tone="stock" className="mt-4 text-xs">
                Your store is part of the FINDIT Pilot. No payment is required
                during the pilot.
              </GlassNotice>
            ) : null}
            <p className="mt-3 text-xs">
              <Link
                href="/store/demand"
                className="font-semibold text-accent-ink underline underline-offset-2"
              >
                See demand insights
              </Link>
            </p>
          </Card>
        </>
      ) : (
        <GlassNotice className="mt-6">
          Clear unanswered requests below. Owners see demand and settings.
        </GlassNotice>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Incoming Requests</h2>
        <div className="flex flex-wrap gap-2">
          <GlassSelect
            aria-label="Filter requests by response"
            className="h-10 w-auto px-3 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="unanswered">Unanswered</option>
            <option value="in_stock">In Stock</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="can_order">Can Order</option>
            <option value="expired">Expired</option>
          </GlassSelect>
          <GlassSelect
            aria-label="Filter requests by time range"
            className="h-10 w-auto px-3 text-sm"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
          </GlassSelect>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            title="No requests in this view"
            description={`Try another filter (Unanswered / All) or time range. When customers near your ZIP ask, they appear here.`}
          />
        ) : (
          items.map((item) => (
            <GlassCard
              key={item.id}
              className="glass-lift relative overflow-hidden p-5 pl-6"
            >
              {item.response ? (
                <StatusRail tone={toneForResponse(item.response.response_type)} />
              ) : null}
              <div className="flex gap-4">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt=""
                    className="h-20 w-20 rounded-glass-lg object-cover"
                  />
                ) : (
                  <div className="glass-subtle flex h-20 w-20 items-center justify-center rounded-glass-lg text-xs text-ink-subtle">
                    No photo
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-muted">
                    {formatRelativeTime(item.created_at)} · Near {item.postal_code}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold uppercase tracking-wide text-ink">
                    {item.product_name}
                  </h3>
                  {item.description ? (
                    <p className="mt-1 text-sm text-ink-muted line-clamp-2">
                      {item.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-ink-subtle">
                    {formatExpiresIn(item.expires_at)}
                  </p>
                </div>
              </div>

              {item.response ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <StatusBadge type={item.response.response_type} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActiveRequest(item);
                      setSheet(
                        item.response?.response_type === "can_order"
                          ? "can_order"
                          : "in_stock"
                      );
                    }}
                  >
                    Update response
                  </Button>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Button
                    variant="softSuccess"
                    size="sm"
                    className="min-h-11"
                    disabled={submitting}
                    onClick={async () => {
                      await respond("in_stock", item);
                    }}
                  >
                    In Stock
                  </Button>
                  <Button
                    variant="softMuted"
                    size="sm"
                    className="min-h-11"
                    disabled={submitting}
                    onClick={async () => {
                      await respond("out_of_stock", item);
                    }}
                  >
                    Out
                  </Button>
                  <Button
                    variant="softWarning"
                    size="sm"
                    className="min-h-11"
                    disabled={submitting}
                    onClick={async () => {
                      await respond("can_order", item);
                    }}
                  >
                    Can Order
                  </Button>
                </div>
              )}
              {!item.response ? (
                <button
                  type="button"
                  className="mt-3 text-xs font-semibold text-ink-muted underline underline-offset-2 transition-colors hover:text-accent-ink"
                  onClick={() => {
                    setActiveRequest(item);
                    setSheet("in_stock");
                  }}
                >
                  Add optional details
                </button>
              ) : null}
            </GlassCard>
          ))
        )}
      </div>

      <BottomSheet
        open={sheet === "in_stock"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Confirm in stock"
        description="Optional details help the customer decide quickly."
      >
        <div className="space-y-4 pb-4">
          <div>
            <Label>Price</Label>
            <Input
              placeholder="$12.99"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace("$", ""))}
              inputMode="decimal"
            />
          </div>
          <div>
            <Label>Quantity available</Label>
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div>
            <Label>How many left? (optional)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {STOCK_AMOUNT_OPTIONS.map((o) => (
                <GlassChip
                  key={o.value}
                  selected={stockAmount === o.value}
                  onClick={() =>
                    setStockAmount(stockAmount === o.value ? "" : o.value)
                  }
                >
                  {o.label}
                </GlassChip>
              ))}
            </div>
          </div>
          <div>
            <Label>Note</Label>
            <Textarea
              placeholder="Behind the front counter."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div>
            <Label>Can hold for customer</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {HOLD_OPTIONS.map((o) => (
                <GlassChip
                  key={o.label}
                  selected={holdMinutes === o.minutes}
                  onClick={() => setHoldMinutes(o.minutes)}
                >
                  {o.label}
                </GlassChip>
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={submitting}
            onClick={() =>
              respond("in_stock", activeRequest, {
                price: price ? Number(price) : null,
                quantity: quantity ? Number(quantity) : null,
                note,
                holdMinutes,
                availabilityAmount: stockAmount || null,
              })
            }
          >
            Confirm In Stock
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "can_order"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Can order"
        description="Tell the customer when it could be available."
      >
        <div className="space-y-4 pb-4">
          <div>
            <Label>Estimated availability</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVAILABILITY_OPTIONS.map((o) => (
                <GlassChip
                  key={o}
                  selected={availability === o}
                  onClick={() => setAvailability(o)}
                >
                  {o}
                </GlassChip>
              ))}
            </div>
          </div>
          <div>
            <Label>Estimated price</Label>
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace("$", ""))}
              inputMode="decimal"
            />
          </div>
          <div>
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={submitting}
            onClick={() =>
              respond("can_order", activeRequest, {
                price: price ? Number(price) : null,
                note,
                estimatedAvailabilityLabel: availability,
              })
            }
          >
            Send to Customer
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "track"}
        onOpenChange={(o) => {
          if (!o) {
            setSheet(null);
            setActiveRequest(null);
          }
        }}
        title="Track this demand?"
        description="Would you like to know if customers keep requesting this product?"
      >
        <div className="flex gap-3 pb-2">
          <Button
            className="flex-1"
            onClick={async () => {
              if (activeRequest) {
                await respondToRequestAction({
                  requestId: activeRequest.id,
                  storeId,
                  responseType: "out_of_stock",
                  trackDemand: true,
                });
              }
              setSheet(null);
              setActiveRequest(null);
              toast.success("We'll track this product");
            }}
          >
            Yes
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            onClick={() => {
              setSheet(null);
              setActiveRequest(null);
            }}
          >
            Not now
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
