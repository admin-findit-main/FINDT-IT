"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { estimateRoutingDistanceMiles, isRequestExpired } from "@findit/domain";
import {
  markStoreRequestOpenedAction,
  respondToRequestAction,
  signOutAction,
} from "@/lib/services/actions";
import {
  resolveHubTerminalAction,
  touchHubDeviceAction,
} from "@/lib/services/hub-devices";
import {
  clockOutHubAction,
  getHubClockStateAction,
} from "@/lib/services/shifts";
import { HubClockGate } from "@/components/hub/clock-gate";
import { HubCheckinPanel } from "@/components/hub/checkin-panel";
import { HubEmployeeRewards } from "@/components/hub/employee-rewards";
import {
  hubConnectHref,
  hubRelinkMessage,
  type HubRelinkReason,
} from "@/lib/hub/relink";
import { useStoreInboxRealtime } from "@/lib/supabase/realtime";
import {
  HUB_DEVICE_HEARTBEAT_MS,
  HUB_INBOX_POLL_MS,
} from "@/lib/hub/constants";
import { armAlertSoundUnlock, playHubAlert } from "@/lib/alert-sound";
import {
  hubRequestsToAlert,
  readHubSeenIds,
  writeHubSeenIds,
} from "@/lib/hub/arrivals";
import { writeCached } from "@/lib/data/client-cache";
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
  // Present whenever this browser is a paired Hub, whether or not a manager
  // is also signed in on it. Check-in and the heartbeat key off this.
  const [deviceId, setDeviceId] = useState<string | null>(null);
  // Why there is no device, so an unpaired tablet can say so instead of
  // showing a ready screen with no way to check anyone in.
  const [deviceIssue, setDeviceIssue] = useState<HubRelinkReason | null>(null);
  const [shiftLocked, setShiftLocked] = useState<boolean | null>(null);
  const [shiftName, setShiftName] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const queueSeq = useRef(0);
  const queueSignature = useRef("");
  const storeId = store?.id;

  const goToLinking = useCallback(
    (reason?: Parameters<typeof hubConnectHref>[0]) => {
      setStore(null);
      setQueue([]);
      queueSignature.current = "";
      setShiftLocked(null);
      setShiftName(null);
      router.replace(hubConnectHref(reason));
    },
    [router]
  );

  const loadRuntime = useCallback(async () => {
    try {
      const linked = await resolveHubTerminalAction();
      if (!linked.ok) {
        goToLinking(linked.reason);
        return null;
      }
      const runtime = linked.runtime;
      if (!isValidId(runtime.store.id)) {
        setError("Store session is invalid.");
        return null;
      }
      setSource(runtime.source);
      setCanManage(runtime.canManage);
      setDeviceName(runtime.deviceName);
      setDeviceId(runtime.deviceId);
      setDeviceIssue(runtime.deviceIssue);
      setStore(runtime.store);
      if (runtime.deviceId) {
        const beat = await touchHubDeviceAction().catch((err) => {
          console.error("[FINDIT Hub] device heartbeat failed", err);
          return { ok: false as const, reason: "disconnected" as const };
        });
        if (beat && "ok" in beat && beat.ok === false) {
          goToLinking(beat.reason);
          return null;
        }
      }
      setError(null);
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
      return runtime.store.id;
    } catch (err) {
      console.error("[FINDIT Hub] runtime failed", err);
      return null;
    }
  }, [goToLinking]);

  const loadQueue = useCallback(async (id: string, opts?: { silent?: boolean }) => {
    const seq = ++queueSeq.current;
    try {
      const res = await fetch(
        `/api/hub/inbox?storeId=${encodeURIComponent(id)}&filter=unanswered&range=7d&t=${Date.now()}`,
        { cache: "no-store", credentials: "same-origin" }
      );
      if (seq !== queueSeq.current) return;
      if (!res.ok) throw new Error("inbox");
      const rows = (await res.json()) as HubRequest[];
      const pending = (Array.isArray(rows) ? rows : [])
        .filter((row) => !row.response)
        .filter((row) => !isRequestExpired(row.expires_at, row.status))
        .sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

      const previous = seenIds.current;
      const arrivedIds = hubRequestsToAlert({
        primed: primed.current,
        seenIds: previous,
        pending,
      });
      if (arrivedIds.length > 0) {
        playHubAlert();
        setNewFlash(true);
        window.setTimeout(() => setNewFlash(false), 1600);
      }
      pending.forEach((row) => previous.add(row.id));
      primed.current = true;
      if (id) writeHubSeenIds(id, previous, sessionStorage);

      const signature = pending.map((row) => row.id).join(",");
      if (signature !== queueSignature.current) {
        queueSignature.current = signature;
        setQueue(pending);
        writeCached(`hub-queue:${id}`, pending);
        setIndex((current) => Math.min(current, Math.max(pending.length - 1, 0)));
      }
      setError(null);
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    } catch (err) {
      if (seq !== queueSeq.current) return;
      console.error("[FINDIT Hub] load failed", err);
      if (!opts?.silent) {
        setError("Couldn't refresh requests. Trying again…");
      }
    }
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? Boolean(store?.id);
    if (!silent) setLoading(true);
    try {
      const id = store?.id || (await loadRuntime());
      if (!id) return;
      const clockState = await getHubClockStateAction();
      if (clockState.required && !clockState.clockedIn) {
        setShiftLocked(true);
        setShiftName(null);
        return;
      }
      setShiftLocked(false);
      setShiftName(
        clockState.required && clockState.clockedIn ? clockState.clockedIn.name : null
      );
      await loadQueue(id, { silent });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [store?.id, loadRuntime, loadQueue]);

  useEffect(() => {
    armAlertSoundUnlock();
  }, []);

  useEffect(() => {
    if (storeId) {
      const remembered = readHubSeenIds(storeId, sessionStorage);
      remembered.forEach((rowId) => seenIds.current.add(rowId));
    }
    void load({ silent: Boolean(storeId) });
  }, [load, storeId]);

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

  const onRealtime = useCallback(() => {
    if (storeId && shiftLocked === false) void loadQueue(storeId, { silent: true });
  }, [storeId, loadQueue, shiftLocked]);
  useStoreInboxRealtime(storeId, { onChange: onRealtime });

  useEffect(() => {
    if (!storeId || shiftLocked !== false) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void loadQueue(storeId, { silent: true });
    };
    tick();
    const id = window.setInterval(tick, HUB_INBOX_POLL_MS);
    return () => window.clearInterval(id);
  }, [storeId, loadQueue, shiftLocked]);

  useEffect(() => {
    if (!deviceId) return;
    const checkLink = async () => {
      if (document.visibilityState !== "visible") return;
      const linked = await resolveHubTerminalAction().catch((err) => {
        console.error("[FINDIT Hub] link check failed", err);
        return null;
      });
      if (linked && !linked.ok) {
        goToLinking(linked.reason);
        return;
      }
      const beat = await touchHubDeviceAction().catch((err) => {
        console.error("[FINDIT Hub] device heartbeat failed", err);
        return { ok: false as const, reason: "disconnected" as const };
      });
      if (beat && "ok" in beat && beat.ok === false) {
        goToLinking(beat.reason);
        return;
      }
      const clockState = await getHubClockStateAction().catch((err) => {
        console.error("[FINDIT Hub] clock check failed", err);
        return null;
      });
      if (clockState?.required && !clockState.clockedIn) {
        setQueue([]);
        queueSignature.current = "";
        setShiftName(null);
        setShiftLocked(true);
      }
    };
    void checkLink();
    const id = window.setInterval(checkLink, HUB_DEVICE_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [deviceId, goToLinking]);

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

  const active = queue[index] ?? null;

  useEffect(() => {
    if (!storeId || !active || !isValidId(active.id) || shiftLocked !== false) return;
    void markStoreRequestOpenedAction(storeId, active.id).catch((err) => {
      console.error("[FINDIT Hub] mark opened failed", err);
    });
  }, [storeId, active, shiftLocked]);

  const distanceLabel = useMemo(() => {
    if (!store || !active) return null;
    const miles = estimateRoutingDistanceMiles({
      customerZip: active.postal_code,
      storeZip: store.postal_code,
      customerCity: active.city,
      storeCity: store.city,
      customerLatitude: active.latitude,
      customerLongitude: active.longitude,
      storeLatitude: store.latitude,
      storeLongitude: store.longitude,
    });
    return formatMiles(miles);
  }, [store, active]);

  function resetComposer() {
    setPanel("actions");
    setPrice("");
    setNote("");
    setAvailability("Today");
    setCustomAvailability("");
  }

  const inFlight = useRef(false);

  async function send(
    responseType: "in_stock" | "out_of_stock" | "can_order",
    extras?: { price?: number | null; note?: string; estimatedAvailabilityLabel?: string }
  ) {
    if (!storeId || !active || busy || inFlight.current) return;
    if (!isValidId(storeId) || !isValidId(active.id)) {
      setError("That request looks invalid. Refresh Hub and try again.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const answeredId = active.id;
    const result = await respondToRequestAction({
      requestId: active.id,
      storeId,
      responseType,
      price: extras?.price ?? null,
      note: extras?.note,
      estimatedAvailabilityLabel: extras?.estimatedAvailabilityLabel,
    });
    setBusy(false);
    inFlight.current = false;
    if ("error" in result && result.error) {
      console.error("[FINDIT Hub] respond failed", result.error);
      setError(result.error);
      return;
    }
    setQueue((q) => q.filter((row) => row.id !== answeredId));
    setSentFlash(true);
    resetComposer();
    window.setTimeout(() => setSentFlash(false), 1400);
    void load({ silent: true });
  }

  if (shiftLocked !== false) {
    if (store && shiftLocked === true) {
      return (
        <HubClockGate
          storeName={store.name}
          onClockedIn={(name) => {
            setShiftName(name);
            setShiftLocked(false);
            setLoading(false);
            void loadQueue(store.id, { silent: false });
          }}
        />
      );
    }
    return (
      <div className="flex h-dvh flex-col items-center justify-center bg-black text-center text-white">
        <BrandLogo kind="business" tone="dark" className="h-7 w-auto" />
        <p className="mt-4 text-2xl font-semibold text-white/80">Preparing Hub…</p>
      </div>
    );
  }

  const parsedPrice = price.trim() ? Number(price) : null;
  const priceInvalid = price.trim() !== "" && (!Number.isFinite(parsedPrice) || Number(parsedPrice) < 0);

  return (
    <div className="hub-root relative flex h-dvh flex-col overflow-hidden bg-black text-white select-none">
      {newFlash ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30 bg-[#E5231B]/35"
        />
      ) : null}

      <header className="flex shrink-0 items-center justify-between px-5 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <BrandLogo kind="business" tone="dark" className="h-6" />
          <span className="hidden text-white/25 sm:inline">·</span>
          <p className="max-w-[40vw] truncate text-sm text-white/70">{store?.name || "Store"}</p>
          {shiftName ? (
            <span className="hidden max-w-[20vw] truncate text-sm text-white/50 sm:inline">
              {shiftName}
            </span>
          ) : null}
          {queue.length > 0 ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
              {queue.length} waiting
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {active && deviceId ? <HubCheckinPanel compact /> : null}
          {/* A busy store can sit on the request view all day and never see the
              idle screen, so the unpaired state has to be reachable here too. */}
          {active && !deviceId ? (
            <button
              type="button"
              onClick={() => goToLinking(deviceIssue)}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10"
            >
              Check-in off
            </button>
          ) : null}
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
          <p className="text-lg font-bold">FINDIT HUB is offline</p>
          <p className="text-sm text-white/70">Reconnecting…</p>
        </div>
      ) : null}

      {error ? (
        <div className="mx-6 mb-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center text-sm text-white/80">
          {error}
        </div>
      ) : null}

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5 md:px-8">
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
          deviceId ? (
            <div className="flex min-h-0 flex-1 items-center gap-8 md:gap-16">
              <div className="min-w-0 flex-1">
                <BrandLogo kind="business" tone="dark" className="h-8 w-auto" />
                <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
                  Ready for requests
                </h1>
                <p className="mt-4 text-xl text-white/70">{store?.name}</p>
                <p className="mt-8 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-emerald-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Listening for nearby requests
                </p>
                <HubEmployeeRewards />
              </div>
              <div className="w-[min(42vw,22rem)] shrink-0">
                <HubCheckinPanel />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center gap-8 md:gap-16">
              <div className="min-w-0 flex-1">
                <BrandLogo kind="business" tone="dark" className="h-8 w-auto" />
                <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
                  Ready for requests
                </h1>
                <p className="mt-4 text-xl text-white/70">{store?.name}</p>
                <p className="mt-8 flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-emerald-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Listening for nearby requests
                </p>
                <HubEmployeeRewards />
              </div>
              <div className="w-[min(42vw,22rem)] shrink-0 rounded-2xl border border-white/15 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-white/40">
                  Check-in
                </p>
                <p className="mt-3 text-xl font-semibold">
                  {deviceIssue === "missing"
                    ? "This tablet isn’t connected"
                    : "This tablet needs reconnecting"}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  {hubRelinkMessage(deviceIssue) ||
                    "Connect it to show a check-in QR and clock staff in. Answering requests works either way."}
                </p>
                <button
                  type="button"
                  onClick={() => goToLinking(deviceIssue)}
                  className="mt-6 min-h-12 w-full rounded-full bg-white px-6 text-sm font-semibold text-black"
                >
                  Connect this device
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-[0.2em] text-[#E5231B]">NEW REQUEST</p>
                <p className="mt-0.5 truncate text-sm text-white/60">{distanceLabel}</p>
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

            <div className="mt-3 grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(14rem,0.85fr)] gap-4 overflow-hidden md:gap-6">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                {active.image_url ? (
                  <figure className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl bg-[#111113] ring-1 ring-inset ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={active.image_url}
                      alt={active.product_name}
                      draggable={false}
                      className="h-full w-full object-contain"
                    />
                  </figure>
                ) : null}
                <div className={`min-w-0 shrink-0 ${active.image_url ? "mt-3" : "flex-1"}`}>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">Product</p>
                  <h1
                    className={
                      active.image_url
                        ? "mt-1 truncate text-2xl font-bold tracking-tight md:text-4xl"
                        : "mt-2 text-5xl font-bold leading-none tracking-tight md:text-7xl"
                    }
                  >
                    {active.product_name}
                  </h1>
                  {active.description ? (
                    <p
                      className={
                        active.image_url
                          ? "mt-1 truncate text-base text-white/80 md:text-xl"
                          : "mt-4 text-3xl font-semibold text-white/90"
                      }
                    >
                      {active.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-white/50" data-clock={clock}>
                    {formatRequestedAgo(active.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex min-h-0 flex-col justify-stretch gap-3 overflow-hidden">
                {panel === "actions" ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || !online}
                      onClick={() => setPanel("in_stock")}
                      className="flex min-h-0 flex-1 items-center justify-center rounded-3xl bg-[#0E9F6E] text-2xl font-bold tracking-tight text-white disabled:opacity-40 md:text-3xl"
                    >
                      IN STOCK
                    </button>
                    <button
                      type="button"
                      disabled={busy || !online}
                      onClick={() => void send("out_of_stock")}
                      className="flex min-h-0 flex-1 items-center justify-center rounded-3xl bg-white/12 text-2xl font-bold tracking-tight text-white disabled:opacity-40 md:text-3xl"
                    >
                      OUT OF STOCK
                    </button>
                    <button
                      type="button"
                      disabled={busy || !online}
                      onClick={() => setPanel("can_order")}
                      className="flex min-h-0 flex-1 items-center justify-center rounded-3xl bg-[#C77700] text-2xl font-bold tracking-tight text-white disabled:opacity-40 md:text-3xl"
                    >
                      CAN ORDER
                    </button>
                  </>
                ) : null}

                {panel === "in_stock" ? (
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-3xl bg-white/8 p-5">
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
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-3xl bg-white/8 p-5">
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
            <BrandLogo kind="business" tone="dark" className="h-6" />
            <p className="mt-2 text-2xl font-bold">{store?.name}</p>
            {deviceName ? (
              <p className="mt-1 text-sm text-white/60">{deviceName}</p>
            ) : null}
            {shiftName ? (
              <p className="mt-1 text-sm text-white/70">Clocked in as {shiftName}</p>
            ) : null}
            <p className="mt-2 text-sm text-white/50">
              {deviceId
                ? "This terminal is connected to the store. The owner can disconnect it from Devices in FINDIT Business."
                : "Countertop terminal for this store. Exit returns to FINDIT Business — this screen does not sign you out of FINDIT."}
            </p>
            {!deviceId ? (
              <button
                type="button"
                onClick={() => goToLinking(deviceIssue)}
                className="mt-6 min-h-14 w-full rounded-2xl bg-white text-lg font-semibold text-black"
              >
                Connect this device
              </button>
            ) : null}
            {deviceId && shiftName ? (
              <button
                type="button"
                onClick={async () => {
                  await clockOutHubAction();
                  setSettingsOpen(false);
                  setQueue([]);
                  queueSignature.current = "";
                  setIndex(0);
                  setShiftName(null);
                  setShiftLocked(true);
                }}
                className="mt-6 min-h-14 w-full rounded-2xl bg-[#E5231B] text-lg font-semibold"
              >
                Clock out
              </button>
            ) : null}
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
