"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { estimateZipDistanceMiles, isRequestExpired } from "@findit/domain";
import {
  getStoreIncomingRequestsAction,
  markStoreRequestOpenedAction,
  respondToRequestAction,
  signOutAction,
} from "@/lib/services/actions";
import {
  getHubRuntimeAction,
  touchHubDeviceAction,
} from "@/lib/services/hub-devices";
import { useStoreInboxRealtime } from "@/lib/supabase/realtime";
import { BrandLogo } from "@/components/brand/logo";
import type { CustomerRequest, Store, StoreResponse } from "@/types/database";

type HubRequest = CustomerRequest & {
  target: { id: string };
  response: StoreResponse | null;
};

type Panel = "actions" | "in_stock" | "can_order";

const REQUEST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HUB_AVAILABILITY = ["Today", "Tomorrow", "2–3 days", "Custom"] as const;

function isValidId(id: string | undefined): id is string {
  return Boolean(id && REQUEST_ID_RE.test(id));
}

function formatRequestedAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `Requested ${seconds} second${seconds === 1 ? "" : "s"} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Requested ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `Requested ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

function formatMiles(miles: number): string {
  if (miles <= 0) return "Nearby";
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}

function playHubAlert() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
    osc.onended = () => void ctx.close();
  } catch (err) {
    console.error("[FINDIT Hub] alert sound failed", err);
  }
}

export default function FinditHubPage() {
  const router = useRouter();
  const [store, setStore] = useState<Store | null>(null);
  const [queue, setQueue] = useState<HubRequest[]>([]);
  const [index, setIndex] = useState(0);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("actions");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [availability, setAvailability] = useState<(typeof HUB_AVAILABILITY)[number]>("Today");
  const [customAvailability, setCustomAvailability] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentFlash, setSentFlash] = useState(false);
  const [newFlash, setNewFlash] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clock, setClock] = useState(0);
  const [source, setSource] = useState<"device" | "member" | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const storeId = store?.id;

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const runtime = await getHubRuntimeAction();
      if (!runtime?.store) {
        setError("This Hub is not linked to an approved store.");
        setStore(null);
        setQueue([]);
        if (!opts?.silent) router.replace("/store/hub/connect");
        return;
      }
      const nextStore = runtime.store;
      setSource(runtime.source);
      setCanManage(runtime.canManage);
      setDeviceName(runtime.deviceName);
      if (runtime.source === "device") {
        void touchHubDeviceAction().catch((err) => {
          console.error("[FINDIT Hub] device heartbeat failed", err);
        });
      }
      if (!isValidId(nextStore.id)) {
        setError("Store session is invalid.");
        return;
      }
      const rows = await getStoreIncomingRequestsAction(nextStore.id, "unanswered", "7d");
      const pending = (rows as HubRequest[])
        .filter((row) => !row.response)
        .filter((row) => !isRequestExpired(row.expires_at, row.status))
        .sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

      const previous = seenIds.current;
      const arrived = pending.filter((row) => primed.current && !previous.has(row.id));
      if (arrived.length > 0) {
        playHubAlert();
        setNewFlash(true);
        window.setTimeout(() => setNewFlash(false), 1600);
      }
      pending.forEach((row) => previous.add(row.id));
      primed.current = true;

      setStore(nextStore);
      setQueue(pending);
      setIndex((current) => Math.min(current, Math.max(pending.length - 1, 0)));
      setError(null);
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    } catch (err) {
      console.error("[FINDIT Hub] load failed", err);
      setError("Couldn't refresh requests. Trying again…");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setClock((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void load({ silent: true });
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load({ silent: true });
    }, 3000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    let wake: WakeLockSentinel | null = null;
    const requestLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wake = await navigator.wakeLock.request("screen");
        }
      } catch (err) {
        console.error("[FINDIT Hub] wake lock unavailable", err);
      }
    };
    void requestLock();
    const onVisible = () => {
      if (document.visibilityState === "visible") void requestLock();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void wake?.release();
    };
  }, []);

  const onRealtime = useCallback(() => {
    void load({ silent: true });
  }, [load]);
  useStoreInboxRealtime(storeId, { onChange: onRealtime });

  const active = queue[index] ?? null;

  useEffect(() => {
    if (!storeId || !active || !isValidId(active.id)) return;
    void markStoreRequestOpenedAction(storeId, active.id).catch((err) => {
      console.error("[FINDIT Hub] mark opened failed", err);
    });
  }, [storeId, active]);

  const distanceLabel = useMemo(() => {
    if (!store || !active) return null;
    const miles = estimateZipDistanceMiles(
      active.postal_code,
      store.postal_code,
      store.city,
      active.city
    );
    return formatMiles(miles);
  }, [store, active]);

  function resetComposer() {
    setPanel("actions");
    setPrice("");
    setNote("");
    setAvailability("Today");
    setCustomAvailability("");
  }

  async function send(
    responseType: "in_stock" | "out_of_stock" | "can_order",
    extras?: { price?: number | null; note?: string; estimatedAvailabilityLabel?: string }
  ) {
    if (!storeId || !active || busy) return;
    if (!isValidId(storeId) || !isValidId(active.id)) {
      setError("That request looks invalid. Refresh Hub and try again.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await respondToRequestAction({
      requestId: active.id,
      storeId,
      responseType,
      price: extras?.price ?? null,
      note: extras?.note,
      estimatedAvailabilityLabel: extras?.estimatedAvailabilityLabel,
    });
    setBusy(false);
    if ("error" in result && result.error) {
      console.error("[FINDIT Hub] respond failed", result.error);
      setError(result.error);
      return;
    }
    setSentFlash(true);
    resetComposer();
    window.setTimeout(() => {
      setSentFlash(false);
      void load({ silent: true });
    }, 1400);
  }

  const parsedPrice = price.trim() ? Number(price) : null;
  const priceInvalid = price.trim() !== "" && (!Number.isFinite(parsedPrice) || Number(parsedPrice) < 0);

  return (
    <div className="hub-root relative flex min-h-dvh flex-col overflow-hidden bg-black text-white select-none">
      {newFlash ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30 bg-[#E5231B]/35"
        />
      ) : null}

      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <BrandLogo kind="business" tone="dark" className="h-5 w-auto" />
          <span className="hidden text-white/25 sm:inline">·</span>
          <p className="max-w-[40vw] truncate text-sm text-white/70">{store?.name || "Store"}</p>
          {queue.length > 0 ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
              {queue.length} waiting
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <span
              className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-400" : "bg-[#E5231B]"}`}
            />
            {online ? "Connected" : "Offline"}
          </span>
          <button
            type="button"
            aria-label="Hub settings"
            onClick={() => setSettingsOpen((open) => !open)}
            className="grid h-11 w-11 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {!online ? (
        <div className="mx-6 mb-2 rounded-2xl border border-[#E5231B]/40 bg-[#E5231B]/15 px-5 py-3 text-center">
          <p className="text-lg font-bold">Connection lost</p>
          <p className="text-sm text-white/70">Reconnecting…</p>
        </div>
      ) : null}

      {error ? (
        <div className="mx-6 mb-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center text-sm text-white/80">
          {error}
        </div>
      ) : null}

      <main className="relative flex flex-1 flex-col px-6 pb-8 md:px-12">
        {sentFlash ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-6xl font-bold text-emerald-400">✓</p>
            <p className="mt-4 text-3xl font-bold tracking-tight">RESPONSE SENT</p>
          </div>
        ) : loading && !store ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <BrandLogo kind="business" tone="dark" className="h-7 w-auto" />
            <p className="mt-4 text-2xl font-semibold text-white/80">Preparing Hub…</p>
          </div>
        ) : !active ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <BrandLogo kind="business" tone="dark" className="mx-auto h-8 w-auto" />
            <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">
              Ready for requests
            </h1>
            <p className="mt-4 text-xl text-white/70">{store?.name}</p>
            <p className="mt-10 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Listening for nearby requests
            </p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold tracking-[0.2em] text-[#E5231B]">NEW REQUEST</p>
                <p className="mt-1 text-white/60">{distanceLabel}</p>
              </div>
              {queue.length > 1 ? (
                <div className="flex items-center gap-3 text-sm text-white/60">
                  <button
                    type="button"
                    className="rounded-full px-3 py-2 hover:bg-white/10"
                    onClick={() => setIndex((i) => (i - 1 + queue.length) % queue.length)}
                  >
                    ←
                  </button>
                  <span>
                    {index + 1} of {queue.length} waiting
                  </span>
                  <button
                    type="button"
                    className="rounded-full px-3 py-2 hover:bg-white/10"
                    onClick={() => setIndex((i) => (i + 1) % queue.length)}
                  >
                    →
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid flex-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div>
                {active.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={active.image_url}
                    alt=""
                    className="mb-6 max-h-56 w-full rounded-3xl object-cover"
                  />
                ) : null}
                <p className="text-sm uppercase tracking-[0.18em] text-white/40">Product</p>
                <h1 className="mt-2 text-5xl font-bold leading-none tracking-tight md:text-7xl">
                  {active.product_name}
                </h1>
                {active.description ? (
                  <>
                    <p className="mt-6 text-sm uppercase tracking-[0.18em] text-white/40">
                      Variant
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-white/90">{active.description}</p>
                  </>
                ) : null}
                <p className="mt-6 text-white/50" data-clock={clock}>
                  {formatRequestedAgo(active.created_at)}
                </p>
              </div>

              <div className="flex flex-col justify-end gap-4">
                {panel === "actions" ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || !online}
                      onClick={() => setPanel("in_stock")}
                      className="min-h-24 rounded-3xl bg-[#0E9F6E] text-3xl font-bold tracking-tight text-white disabled:opacity-40"
                    >
                      IN STOCK
                    </button>
                    <button
                      type="button"
                      disabled={busy || !online}
                      onClick={() => void send("out_of_stock")}
                      className="min-h-24 rounded-3xl bg-white/12 text-3xl font-bold tracking-tight text-white disabled:opacity-40"
                    >
                      OUT OF STOCK
                    </button>
                    <button
                      type="button"
                      disabled={busy || !online}
                      onClick={() => setPanel("can_order")}
                      className="min-h-24 rounded-3xl bg-[#C77700] text-3xl font-bold tracking-tight text-white disabled:opacity-40"
                    >
                      CAN ORDER
                    </button>
                  </>
                ) : null}

                {panel === "in_stock" ? (
                  <div className="rounded-3xl bg-white/8 p-6">
                    <p className="text-lg font-semibold">Optional details</p>
                    <label className="mt-4 block text-sm text-white/50">Price</label>
                    <input
                      inputMode="decimal"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="$"
                      className="mt-1 w-full rounded-2xl bg-black/40 px-4 py-4 text-2xl outline-none"
                    />
                    <label className="mt-4 block text-sm text-white/50">Note</label>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="mt-1 w-full rounded-2xl bg-black/40 px-4 py-4 text-xl outline-none"
                    />
                    {priceInvalid ? (
                      <p className="mt-2 text-sm text-[#FF8078]">Enter a valid price or leave it blank.</p>
                    ) : null}
                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={busy || priceInvalid}
                        onClick={() =>
                          void send("in_stock", {
                            price: parsedPrice,
                            note: note.trim() || undefined,
                          })
                        }
                        className="min-h-16 rounded-2xl bg-[#0E9F6E] text-xl font-bold"
                      >
                        SEND
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void send("in_stock")}
                        className="min-h-16 rounded-2xl bg-white/10 text-xl font-bold"
                      >
                        SKIP & SEND
                      </button>
                    </div>
                    <button
                      type="button"
                      className="mt-3 w-full py-3 text-white/50"
                      onClick={() => setPanel("actions")}
                    >
                      Back
                    </button>
                  </div>
                ) : null}

                {panel === "can_order" ? (
                  <div className="rounded-3xl bg-white/8 p-6">
                    <p className="text-lg font-semibold">Estimated availability</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {HUB_AVAILABILITY.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setAvailability(option)}
                          className={`min-h-14 rounded-2xl text-lg font-semibold ${
                            availability === option ? "bg-[#C77700]" : "bg-black/40"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    {availability === "Custom" ? (
                      <input
                        value={customAvailability}
                        onChange={(e) => setCustomAvailability(e.target.value)}
                        placeholder="e.g. Friday"
                        className="mt-3 w-full rounded-2xl bg-black/40 px-4 py-4 text-xl outline-none"
                      />
                    ) : null}
                    <label className="mt-4 block text-sm text-white/50">Price</label>
                    <input
                      inputMode="decimal"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="$"
                      className="mt-1 w-full rounded-2xl bg-black/40 px-4 py-4 text-2xl outline-none"
                    />
                    <label className="mt-4 block text-sm text-white/50">Note</label>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="mt-1 w-full rounded-2xl bg-black/40 px-4 py-4 text-xl outline-none"
                    />
                    {priceInvalid ? (
                      <p className="mt-2 text-sm text-[#FF8078]">Enter a valid price or leave it blank.</p>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy || priceInvalid || (availability === "Custom" && !customAvailability.trim())}
                      onClick={() =>
                        void send("can_order", {
                          price: parsedPrice,
                          note: note.trim() || undefined,
                          estimatedAvailabilityLabel:
                            availability === "Custom" ? customAvailability.trim() : availability,
                        })
                      }
                      className="mt-6 min-h-16 w-full rounded-2xl bg-[#C77700] text-xl font-bold"
                    >
                      SEND RESPONSE
                    </button>
                    <button
                      type="button"
                      className="mt-3 w-full py-3 text-white/50"
                      onClick={() => setPanel("actions")}
                    >
                      Back
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </main>

      {settingsOpen ? (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/70 p-6 md:items-center">
          <div className="w-full max-w-md rounded-3xl bg-[#141416] p-6">
            <BrandLogo kind="business" tone="dark" className="h-5 w-auto" />
            <p className="mt-2 text-2xl font-bold">{store?.name}</p>
            {deviceName ? (
              <p className="mt-1 text-sm text-white/60">{deviceName}</p>
            ) : null}
            <p className="mt-2 text-sm text-white/50">
              {source === "device"
                ? "This terminal is connected to the store. The owner can disconnect it from Devices in FINDIT Business."
                : "Countertop terminal for this store. Exit returns to FINDIT Business — this screen does not sign you out of FINDIT."}
            </p>
            {source === "member" && canManage ? (
              <button
                type="button"
                onClick={() => router.push("/store")}
                className="mt-6 min-h-14 w-full rounded-2xl bg-white/10 text-lg font-semibold"
              >
                Exit Hub
              </button>
            ) : null}
            {source === "member" && !canManage ? (
              <>
                <button
                  type="button"
                  onClick={() => router.push("/store/requests")}
                  className="mt-6 min-h-14 w-full rounded-2xl bg-white/10 text-lg font-semibold"
                >
                  Request history
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOutAction();
                    router.replace("/login/business");
                  }}
                  className="mt-3 min-h-14 w-full rounded-2xl bg-white/10 text-lg font-semibold"
                >
                  Sign out
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="mt-3 w-full py-3 text-white/40"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
