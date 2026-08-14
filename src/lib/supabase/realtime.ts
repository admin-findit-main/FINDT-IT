"use client";

import { useEffect } from "react";

type RealtimeHandlers = {
  onChange: () => void;
};

/**
 * Subscribe to Supabase postgres changes when configured.
 * Missing keys: no-op (callers may still poll as fallback).
 */
export function useRequestRealtime(
  requestId: string | undefined,
  { onChange }: RealtimeHandlers
) {
  useEffect(() => {
    if (!requestId) return;
    if (typeof window === "undefined") return;
    if (process.env.NEXT_PUBLIC_FINDIT_DEMO_MODE === "true") return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return;
    }

    let cancelled = false;
    let channel: { unsubscribe: () => void } | null = null;

    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        if (cancelled) return;

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
            () => onChange()
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "customer_requests",
              filter: `id=eq.${requestId}`,
            },
            () => onChange()
          )
          .subscribe();

        channel = { unsubscribe: () => supabase.removeChannel(ch) };
      } catch {
        // Keep polling fallback
      }
    })();

    return () => {
      cancelled = true;
      channel?.unsubscribe();
    };
  }, [requestId, onChange]);
}

export function useStoreInboxRealtime(
  storeId: string | undefined,
  { onChange }: RealtimeHandlers
) {
  useEffect(() => {
    if (!storeId) return;
    if (typeof window === "undefined") return;
    if (process.env.NEXT_PUBLIC_FINDIT_DEMO_MODE === "true") return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return;
    }

    let cancelled = false;
    let channel: { unsubscribe: () => void } | null = null;

    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        if (cancelled) return;

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
            () => onChange()
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "store_responses",
              filter: `store_id=eq.${storeId}`,
            },
            () => onChange()
          )
          .subscribe();

        channel = { unsubscribe: () => supabase.removeChannel(ch) };
      } catch {
        // Keep polling fallback
      }
    })();

    return () => {
      cancelled = true;
      channel?.unsubscribe();
    };
  }, [storeId, onChange]);
}
