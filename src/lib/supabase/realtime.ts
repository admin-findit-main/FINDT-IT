"use client";

import { useEffect, useRef, useState } from "react";

export const LIVE_POLL_MS = 8000;
export const SEARCHING_POLL_MS = 4000;

export type RealtimeSync = {
  state: "idle" | "connecting" | "live" | "polling";
  percent: number;
};

type RealtimeHandlers = {
  onChange: () => void;
};

type RealtimeAuthClient = {
  auth: {
    getSession: () => Promise<{
      data: { session: { access_token: string } | null };
    }>;
    onAuthStateChange: (
      callback: (
        event: string,
        session: { access_token: string } | null
      ) => void
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
  realtime: {
    setAuth?: (token: string) => unknown;
  };
};

/**
 * Hold the latest `value` in a ref without writing to it during render.
 *
 * Only realtime callbacks read this, and those cannot run before the commit
 * that assigns it, so syncing in an effect loses nothing.
 */
function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function realtimeConfigured() {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_FINDIT_DEMO_MODE === "true") return false;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  );
}

async function authorizeRealtime(supabase: RealtimeAuthClient) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token && typeof supabase.realtime.setAuth === "function") {
    await supabase.realtime.setAuth(session.access_token);
  }
  return supabase.auth.onAuthStateChange((_event, next) => {
    if (next?.access_token && typeof supabase.realtime.setAuth === "function") {
      void supabase.realtime.setAuth(next.access_token);
    }
  });
}

/**
 * Subscribe to Supabase postgres changes when configured.
 * Missing keys: no-op (callers may still poll as fallback).
 * `onChange` is stored in a ref so identity changes do not resubscribe.
 */
export function useRequestRealtime(
  requestId: string | undefined,
  { onChange }: RealtimeHandlers
): RealtimeSync {
  const onChangeRef = useLatestRef(onChange);
  const [sync, setSync] = useState<RealtimeSync>({
    state: requestId ? "connecting" : "idle",
    percent: requestId ? 18 : 0,
  });

  useEffect(() => {
    if (!requestId || !realtimeConfigured()) {
      setSync({
        state: requestId ? "polling" : "idle",
        percent: requestId ? 40 : 0,
      });
      return;
    }

    let cancelled = false;
    let channel: { unsubscribe: () => void } | null = null;
    let authSub: { unsubscribe: () => void } | null = null;
    setSync({ state: "connecting", percent: 22 });

    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        if (cancelled) return;
        const auth = await authorizeRealtime(
          supabase as unknown as RealtimeAuthClient
        );
        authSub = auth.data.subscription;
        if (cancelled) return;

        const fire = () => onChangeRef.current();
        const ch = supabase
          .channel(`request:${requestId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "store_responses",
              filter: `request_id=eq.${requestId}`,
            },
            fire
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "customer_requests",
              filter: `id=eq.${requestId}`,
            },
            fire
          )
          .subscribe((status) => {
            if (cancelled) return;
            if (status === "SUBSCRIBED") {
              setSync({ state: "live", percent: 100 });
              return;
            }
            if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              setSync({ state: "polling", percent: 55 });
            }
          });

        channel = { unsubscribe: () => supabase.removeChannel(ch) };
      } catch {
        if (!cancelled) setSync({ state: "polling", percent: 45 });
      }
    })();

    return () => {
      cancelled = true;
      authSub?.unsubscribe();
      channel?.unsubscribe();
    };
    // `onChangeRef` is a stable ref object; it is listed only because the
    // custom hook hides that fact from the exhaustive-deps rule.
  }, [requestId, onChangeRef]);

  return sync;
}

export function useStoreInboxRealtime(
  storeId: string | undefined,
  { onChange }: RealtimeHandlers
): RealtimeSync {
  const onChangeRef = useLatestRef(onChange);
  const [sync, setSync] = useState<RealtimeSync>({
    state: storeId ? "connecting" : "idle",
    percent: storeId ? 18 : 0,
  });

  useEffect(() => {
    if (!storeId || !realtimeConfigured()) {
      setSync({
        state: storeId ? "polling" : "idle",
        percent: storeId ? 40 : 0,
      });
      return;
    }

    let cancelled = false;
    let channel: { unsubscribe: () => void } | null = null;
    let authSub: { unsubscribe: () => void } | null = null;
    setSync({ state: "connecting", percent: 22 });

    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        if (cancelled) return;
        const auth = await authorizeRealtime(
          supabase as unknown as RealtimeAuthClient
        );
        authSub = auth.data.subscription;
        if (cancelled) return;

        const fire = () => onChangeRef.current();
        const ch = supabase
          .channel(`store-inbox:${storeId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "request_targets",
              filter: `store_id=eq.${storeId}`,
            },
            fire
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "store_responses",
              filter: `store_id=eq.${storeId}`,
            },
            fire
          )
          .subscribe((status) => {
            if (cancelled) return;
            if (status === "SUBSCRIBED") {
              setSync({ state: "live", percent: 100 });
              return;
            }
            if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              setSync({ state: "polling", percent: 55 });
            }
          });

        channel = { unsubscribe: () => supabase.removeChannel(ch) };
      } catch {
        if (!cancelled) setSync({ state: "polling", percent: 45 });
      }
    })();

    return () => {
      cancelled = true;
      authSub?.unsubscribe();
      channel?.unsubscribe();
    };
    // Stable ref object; see the note in `useRequestRealtime`.
  }, [storeId, onChangeRef]);

  return sync;
}
