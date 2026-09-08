"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isRequestExpired } from "@findit/domain";
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
import { HubCustomerWorkspace } from "@/components/hub/customer-workspace";
import { HubHeader } from "@/components/hub/header";
import {
  HubNavigation,
  type HubSection,
} from "@/components/hub/navigation";
import {
  HubRequestsWorkspace,
  type HubRequest,
} from "@/components/hub/requests-workspace";
import { HubHistoryWorkspace } from "@/components/hub/history-workspace";
import { HubSettingsWorkspace } from "@/components/hub/settings-workspace";
import { hubConnectHref, type HubRelinkReason } from "@/lib/hub/relink";
import { useStoreInboxRealtime } from "@/lib/supabase/realtime";
import {
  HUB_DEVICE_HEARTBEAT_MS,
  HUB_INBOX_POLL_MS,
} from "@/lib/hub/constants";
import { armAlertSoundUnlock, playHubAlert } from "@/lib/alert-sound";
import type { Store } from "@/types/database";

const REQUEST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidId(id: string | undefined): id is string {
  return Boolean(id && REQUEST_ID_RE.test(id));
}

export default function FinditHubPage() {
  const router = useRouter();
  const [section, setSection] = useState<HubSection>("customers");
  const [store, setStore] = useState<Store | null>(null);
  const [queue, setQueue] = useState<HubRequest[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentFlash, setSentFlash] = useState(false);
  const [newFlash, setNewFlash] = useState(false);
  const [source, setSource] = useState<"device" | "member" | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceIssue, setDeviceIssue] = useState<HubRelinkReason | null>(null);
  const [shiftLocked, setShiftLocked] = useState<boolean | null>(null);
  const [shiftName, setShiftName] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const countPrimed = useRef(false);
  const latestCount = useRef(0);
  const queueSeq = useRef(0);
  const countSeq = useRef(0);
  const inFlight = useRef(false);
  const prepareStarted = useRef(false);
  const storeId = store?.id;
  const active = queue[activeIndex] || null;
  const activeId = active?.id;

  const goToLinking = useCallback(
    (reason?: Parameters<typeof hubConnectHref>[0]) => {
      setStore(null);
      setQueue([]);
      setWaitingCount(0);
      latestCount.current = 0;
      countPrimed.current = false;
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
        setError("This HUB isn’t authorized for a store.");
        return null;
      }
      setSource(runtime.source);
      setDeviceName(runtime.deviceName);
      setDeviceId(runtime.deviceId);
      setDeviceIssue(runtime.deviceIssue);
      setStore(runtime.store);
      if (runtime.deviceId) {
        const beat = await touchHubDeviceAction().catch(() => ({
          ok: false as const,
          reason: "disconnected" as const,
        }));
        if ("ok" in beat && beat.ok === false) {
          goToLinking(beat.reason);
          return null;
        }
      }
      setError(null);
      return runtime.store.id;
    } catch (runtimeError) {
      console.error("[FINDIT Hub] runtime failed", runtimeError);
      setError("We couldn’t connect. Try again.");
      return null;
    }
  }, [goToLinking]);

  const notifyCount = useCallback((next: number) => {
    if (countPrimed.current && next > latestCount.current) {
      playHubAlert();
      setNewFlash(true);
      window.setTimeout(() => setNewFlash(false), 900);
    }
    latestCount.current = next;
    countPrimed.current = true;
    setWaitingCount(next);
  }, []);

  const loadCount = useCallback(
    async (id: string) => {
      const seq = ++countSeq.current;
      try {
        const response = await fetch(
          `/api/hub/inbox?storeId=${encodeURIComponent(id)}&mode=count&t=${Date.now()}`,
          { cache: "no-store", credentials: "same-origin" }
        );
        if (seq !== countSeq.current || !response.ok) return;
        const payload = (await response.json()) as { count?: number };
        notifyCount(Math.max(0, Number(payload.count) || 0));
      } catch (countError) {
        console.error("[FINDIT Hub] waiting count failed", countError);
      }
    },
    [notifyCount]
  );

  const loadQueue = useCallback(
    async (id: string, silent = true) => {
      const seq = ++queueSeq.current;
      try {
        const response = await fetch(
          `/api/hub/inbox?storeId=${encodeURIComponent(id)}&filter=unanswered&range=7d&t=${Date.now()}`,
          { cache: "no-store", credentials: "same-origin" }
        );
        if (seq !== queueSeq.current) return;
        if (!response.ok) throw new Error("inbox");
        const rows = (await response.json()) as HubRequest[];
        const pending = (Array.isArray(rows) ? rows : [])
          .filter((row) => !row.response)
          .filter((row) => !isRequestExpired(row.expires_at, row.status))
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          );
        setQueue(pending);
        setActiveIndex((current) =>
          Math.min(current, Math.max(pending.length - 1, 0))
        );
        notifyCount(pending.length);
        setError(null);
      } catch (queueError) {
        console.error("[FINDIT Hub] request load failed", queueError);
        if (!silent) setError("We couldn’t load requests. Try again.");
      }
    },
    [notifyCount]
  );

  const prepare = useCallback(async () => {
    setLoading(true);
    const id = await loadRuntime();
    if (!id) {
      setLoading(false);
      return;
    }
    const clock = await getHubClockStateAction();
    if (clock.required && !clock.clockedIn) {
      setShiftName(null);
      setShiftLocked(true);
      setLoading(false);
      return;
    }
    setShiftLocked(false);
    setShiftName(
      clock.required && clock.clockedIn ? clock.clockedIn.name : null
    );
    await loadCount(id);
    setLoading(false);
  }, [loadRuntime, loadCount]);

  useEffect(() => {
    if (prepareStarted.current) return;
    prepareStarted.current = true;
    armAlertSoundUnlock();
    void prepare();
  }, [prepare]);

  useEffect(() => {
    if (section === "requests" && storeId && shiftLocked === false) {
      void loadQueue(storeId, false);
    }
  }, [section, storeId, shiftLocked, loadQueue]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      if (storeId) void loadCount(storeId);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [storeId, loadCount]);

  const onRealtime = useCallback(() => {
    if (!storeId || shiftLocked !== false) return;
    if (section === "requests") {
      void loadQueue(storeId);
    } else {
      void loadCount(storeId);
    }
  }, [storeId, shiftLocked, section, loadQueue, loadCount]);
  useStoreInboxRealtime(storeId, { onChange: onRealtime });

  useEffect(() => {
    if (!storeId || shiftLocked !== false) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (section === "requests") {
        void loadQueue(storeId);
      } else {
        void loadCount(storeId);
      }
    };
    const timer = window.setInterval(tick, HUB_INBOX_POLL_MS);
    return () => window.clearInterval(timer);
  }, [storeId, shiftLocked, section, loadQueue, loadCount]);

  useEffect(() => {
    if (!deviceId) return;
    const checkDevice = async () => {
      if (document.visibilityState !== "visible") return;
      const linked = await resolveHubTerminalAction().catch(() => null);
      if (linked && !linked.ok) {
        goToLinking(linked.reason);
        return;
      }
      const beat = await touchHubDeviceAction().catch(() => ({
        ok: false as const,
        reason: "disconnected" as const,
      }));
      if ("ok" in beat && beat.ok === false) {
        goToLinking(beat.reason);
        return;
      }
      const clock = await getHubClockStateAction().catch(() => null);
      if (clock?.required && !clock.clockedIn) {
        setQueue([]);
        setWaitingCount(0);
        latestCount.current = 0;
        countPrimed.current = false;
        setShiftName(null);
        setShiftLocked(true);
      }
    };
    const timer = window.setInterval(checkDevice, HUB_DEVICE_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [deviceId, goToLinking]);

  useEffect(() => {
    let wake: WakeLockSentinel | null = null;
    const requestLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wake = await navigator.wakeLock.request("screen");
        }
      } catch (wakeError) {
        console.error("[FINDIT Hub] wake lock unavailable", wakeError);
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

  useEffect(() => {
    if (
      section !== "requests" ||
      !storeId ||
      !isValidId(activeId) ||
      shiftLocked !== false
    ) {
      return;
    }
    void markStoreRequestOpenedAction(storeId, activeId).catch((markError) => {
      console.error("[FINDIT Hub] mark opened failed", markError);
    });
  }, [section, storeId, activeId, shiftLocked]);

  async function answer(
    responseType: "in_stock" | "out_of_stock" | "can_order",
    extras?: {
      price?: number | null;
      note?: string;
      estimatedAvailabilityLabel?: string;
    }
  ) {
    if (!storeId || !active || busy || inFlight.current) return false;
    if (!isValidId(storeId) || !isValidId(active.id)) {
      setError("That request is no longer available.");
      return false;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const answeredId = active.id;
    let result: Awaited<ReturnType<typeof respondToRequestAction>>;
    try {
      result = await respondToRequestAction({
        requestId: active.id,
        storeId,
        responseType,
        price: extras?.price ?? null,
        note: extras?.note,
        estimatedAvailabilityLabel: extras?.estimatedAvailabilityLabel,
      });
    } catch (responseError) {
      console.error("[FINDIT Hub] response failed", responseError);
      setError("We couldn’t send that response. Try again.");
      return false;
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
    if ("error" in result && result.error) {
      console.error("[FINDIT Hub] response failed", result.error);
      setError(result.error);
      return false;
    }
    setQueue((rows) => rows.filter((row) => row.id !== answeredId));
    notifyCount(Math.max(0, latestCount.current - 1));
    setSentFlash(true);
    setHistoryVersion((value) => value + 1);
    window.setTimeout(() => setSentFlash(false), 1000);
    void loadCount(storeId);
    return true;
  }

  async function clockOut() {
    await clockOutHubAction();
    setQueue([]);
    setWaitingCount(0);
    latestCount.current = 0;
    countPrimed.current = false;
    setActiveIndex(0);
    setShiftName(null);
    setShiftLocked(true);
  }

  async function signOut() {
    await signOutAction();
    router.replace("/login/business");
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
            void loadCount(store.id);
          }}
        />
      );
    }
    return (
      <div className="flex h-dvh items-center justify-center bg-[#171315] text-white">
        <div className="text-center">
          <p className="text-2xl font-black tracking-[-0.04em]">
            FINDIT <span className="text-[#D44759]">HUB</span>
          </p>
          <p className="mt-4 text-lg font-semibold text-white/70">
            {loading ? "Preparing Hub…" : "This HUB isn’t authorized for a store."}
          </p>
        </div>
      </div>
    );
  }

  if (!store) return null;

  return (
    <div className="hub-root relative flex h-dvh flex-col overflow-hidden bg-[#F5F2F3] select-none">
      {newFlash ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-50 border-4 border-[#B42332]"
        />
      ) : null}
      <HubHeader
        storeName={store.name}
        online={online}
        employeeName={shiftName}
      />
      {!online || error ? (
        <div className="border-b border-[#E2DCDE] bg-white px-5 py-2 text-center text-sm">
          {!online ? (
            <span className="font-semibold text-[#B42332]">
              We couldn’t connect. Trying again…
            </span>
          ) : (
            <span className="text-[#8E1F2D]">{error}</span>
          )}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        <HubNavigation
          active={section}
          waitingCount={waitingCount}
          onChange={setSection}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {section === "customers" ? (
            <HubCustomerWorkspace
              onPurchaseConfirmed={() =>
                setHistoryVersion((value) => value + 1)
              }
            />
          ) : null}
          {section === "requests" ? (
            <HubRequestsWorkspace
              store={store}
              requests={queue}
              activeIndex={activeIndex}
              busy={busy}
              sent={sentFlash}
              onSelect={setActiveIndex}
              onAnswer={answer}
            />
          ) : null}
          {section === "history" ? (
            <HubHistoryWorkspace refreshKey={historyVersion} />
          ) : null}
          {section === "settings" ? (
            <HubSettingsWorkspace
              storeName={store.name}
              deviceName={deviceName}
              deviceConnected={Boolean(deviceId)}
              online={online}
              employeeName={shiftName}
              canPair={!deviceId}
              canClockOut={Boolean(deviceId && shiftName)}
              canSignOut={source === "member"}
              onPair={() => goToLinking(deviceIssue)}
              onClockOut={clockOut}
              onSignOut={signOut}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
