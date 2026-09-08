"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { estimateRoutingDistanceMiles } from "@findit/domain";
import type { CustomerRequest, Store, StoreResponse } from "@/types/database";

export type HubRequest = CustomerRequest & {
  target: { id: string };
  response: StoreResponse | null;
};

type ResponseType = "in_stock" | "out_of_stock" | "can_order";
type Composer = "choices" | "in_stock" | "can_order";

const AVAILABILITY = ["Today", "Tomorrow", "2–3 days", "Custom"] as const;

function requestedAgo(iso: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  );
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function distanceLabel(store: Store, request: HubRequest) {
  const miles = estimateRoutingDistanceMiles({
    customerZip: request.postal_code,
    storeZip: store.postal_code,
    customerCity: request.city,
    storeCity: store.city,
    customerLatitude: request.latitude,
    customerLongitude: request.longitude,
    storeLatitude: store.latitude,
    storeLongitude: store.longitude,
  });
  if (miles <= 0) return "Nearby";
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

export function HubRequestsWorkspace({
  store,
  requests,
  activeIndex,
  busy,
  sent,
  onSelect,
  onAnswer,
}: {
  store: Store;
  requests: HubRequest[];
  activeIndex: number;
  busy: boolean;
  sent: boolean;
  onSelect: (index: number) => void;
  onAnswer: (
    type: ResponseType,
    extras?: {
      price?: number | null;
      note?: string;
      estimatedAvailabilityLabel?: string;
    }
  ) => Promise<boolean>;
}) {
  const active = requests[activeIndex] || null;
  const [composer, setComposer] = useState<Composer>("choices");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [availability, setAvailability] =
    useState<(typeof AVAILABILITY)[number]>("Today");
  const [customAvailability, setCustomAvailability] = useState("");
  const [, setClock] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setComposer("choices");
    setPrice("");
    setNote("");
    setAvailability("Today");
    setCustomAvailability("");
  }, [active?.id]);

  const activeDistance = useMemo(
    () => (active ? distanceLabel(store, active) : null),
    [active, store]
  );
  const parsedPrice = price.trim() ? Number(price) : null;
  const priceInvalid =
    price.trim() !== "" &&
    (!Number.isFinite(parsedPrice) || Number(parsedPrice) < 0);

  async function submit(
    type: ResponseType,
    extras?: {
      price?: number | null;
      note?: string;
      estimatedAvailabilityLabel?: string;
    }
  ) {
    const ok = await onAnswer(type, extras);
    if (ok) setComposer("choices");
  }

  if (sent) {
    return (
      <section className="flex min-h-full items-center justify-center px-6 text-center">
        <div>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#EAF6EF] text-3xl text-[#18784A]">
            ✓
          </div>
          <h1 className="mt-5 text-3xl font-bold text-[#171315]">Response sent</h1>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-full flex-col px-5 py-6 md:px-8 md:py-8">
      <div className="shrink-0">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#7A1D28]">
          Requests
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#171315]">
          Requests
        </h1>
        <p className="mt-2 text-base text-[#6D6669]">
          {requests.length === 0
            ? "No requests waiting right now."
            : `${requests.length} waiting for an answer`}
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="mt-8 flex min-h-64 flex-1 items-center justify-center rounded-2xl border border-dashed border-[#CEC7CA] bg-white">
          <div className="text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-[#A69DA0]" />
            <p className="mt-3 font-semibold text-[#413B3E]">
              No requests waiting right now.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid min-h-0 flex-1 gap-5 overflow-hidden lg:grid-cols-[minmax(17rem,0.75fr)_minmax(24rem,1.25fr)]">
          <div className="min-h-0 overflow-y-auto rounded-2xl border border-[#DED9DB] bg-white">
            <ul className="divide-y divide-[#E8E3E5]">
              {requests.map((request, index) => (
                <li key={request.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(index)}
                    className={`flex min-h-24 w-full items-center gap-4 px-4 py-3 text-left ${
                      index === activeIndex ? "bg-[#F8EEF0]" : "bg-white"
                    }`}
                  >
                    {request.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={request.image_url}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-xl bg-[#F1EDEF] object-cover"
                      />
                    ) : (
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#F1EDEF]">
                        <MessageCircle className="h-5 w-5 text-[#968D90]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-[#171315]">
                        {request.product_name}
                      </p>
                      <p className="mt-1 text-sm text-[#81797C]">
                        {requestedAgo(request.created_at)}
                        {request.category
                          ? ` · ${request.category}`
                          : ""}
                      </p>
                    </div>
                    <span className="rounded-lg bg-[#8E1F2D] px-3 py-2 text-xs font-bold text-white">
                      ANSWER
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {active ? (
            <div className="min-h-0 overflow-y-auto rounded-2xl border border-[#DED9DB] bg-white p-5 md:p-6">
              <div className="flex items-start gap-5">
                {active.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={active.image_url}
                    alt={active.product_name}
                    className="h-28 w-28 shrink-0 rounded-xl bg-[#F1EDEF] object-contain"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#81797C]">
                    {requestedAgo(active.created_at)} · {activeDistance}
                  </p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#171315]">
                    {active.product_name}
                  </h2>
                  {active.description ? (
                    <p className="mt-2 text-base text-[#6D6669]">
                      {active.description}
                    </p>
                  ) : null}
                </div>
              </div>

              {composer === "choices" ? (
                <div className="mt-7 grid gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setComposer("in_stock")}
                    className="min-h-16 rounded-xl bg-[#188957] text-lg font-bold text-white disabled:opacity-50"
                  >
                    IN STOCK
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submit("out_of_stock")}
                    className="min-h-16 rounded-xl bg-[#B42332] text-lg font-bold text-white disabled:opacity-50"
                  >
                    OUT OF STOCK
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setComposer("can_order")}
                    className="min-h-16 rounded-xl bg-[#2E292B] text-lg font-bold text-white disabled:opacity-50"
                  >
                    CAN ORDER
                  </button>
                </div>
              ) : null}

              {composer !== "choices" ? (
                <div className="mt-7 border-t border-[#E8E3E5] pt-6">
                  {composer === "can_order" ? (
                    <>
                      <p className="text-sm font-semibold text-[#413B3E]">
                        Estimated arrival
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {AVAILABILITY.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setAvailability(option)}
                            className={`min-h-12 rounded-xl border px-3 text-sm font-semibold ${
                              availability === option
                                ? "border-[#171315] bg-[#171315] text-white"
                                : "border-[#D8D1D4] bg-white text-[#413B3E]"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      {availability === "Custom" ? (
                        <input
                          value={customAvailability}
                          onChange={(event) =>
                            setCustomAvailability(event.target.value)
                          }
                          placeholder="e.g. Friday"
                          className="mt-3 min-h-12 w-full rounded-xl border border-[#CEC7CA] px-4 text-[#171315] outline-none focus:border-[#8E1F2D]"
                        />
                      ) : null}
                    </>
                  ) : null}

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-[#413B3E]">
                      Price <span className="font-normal text-[#968D90]">(optional)</span>
                      <input
                        inputMode="decimal"
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        placeholder="$"
                        className="mt-2 min-h-12 w-full rounded-xl border border-[#CEC7CA] px-4 text-lg text-[#171315] outline-none focus:border-[#8E1F2D]"
                      />
                    </label>
                    <label className="text-sm font-semibold text-[#413B3E]">
                      Note <span className="font-normal text-[#968D90]">(optional)</span>
                      <input
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        className="mt-2 min-h-12 w-full rounded-xl border border-[#CEC7CA] px-4 text-[#171315] outline-none focus:border-[#8E1F2D]"
                      />
                    </label>
                  </div>
                  {priceInvalid ? (
                    <p className="mt-2 text-sm text-[#B42332]">
                      Enter a valid price or leave it blank.
                    </p>
                  ) : null}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={
                        busy ||
                        priceInvalid ||
                        (composer === "can_order" &&
                          availability === "Custom" &&
                          !customAvailability.trim())
                      }
                      onClick={() =>
                        void submit(composer, {
                          price: parsedPrice,
                          note: note.trim() || undefined,
                          estimatedAvailabilityLabel:
                            composer === "can_order"
                              ? availability === "Custom"
                                ? customAvailability.trim()
                                : availability
                              : undefined,
                        })
                      }
                      className="min-h-14 rounded-xl bg-[#8E1F2D] font-bold text-white disabled:opacity-50"
                    >
                      {busy ? "SENDING…" : "SEND"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setComposer("choices")}
                      className="min-h-14 rounded-xl border border-[#CEC7CA] font-semibold text-[#5F585B]"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
