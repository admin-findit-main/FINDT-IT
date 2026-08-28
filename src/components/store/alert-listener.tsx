"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { showBrowserNotification } from "@/lib/browser-notify";
import { createClient } from "@/lib/supabase/client";

export function StoreAlertListener({ userId }: { userId: string }) {
  useEffect(() => {
    if (!userId) return;
    if (process.env.NEXT_PUBLIC_FINDIT_DEMO_MODE === "true") return;
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    ) {
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        const supabase = createClient();
        if (cancelled) return;
        const ch = supabase
          .channel(`store-alerts:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              const row = payload.new as {
                title?: string;
                body?: string;
                related_request_id?: string | null;
              };
              const title = row.title || "FINDIT";
              const body = row.body || "A nearby shopper is asking.";
              const url = row.related_request_id
                ? `/store/requests/${row.related_request_id}`
                : "/store";
              toast.success(title, { description: body });
              void showBrowserNotification({
                title,
                body,
                tag: row.related_request_id || title,
                url,
              });
            }
          )
          .subscribe();
        unsubscribe = () => {
          supabase.removeChannel(ch);
        };
      } catch {
        // Notifications page still polls.
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [userId]);

  return null;
}
