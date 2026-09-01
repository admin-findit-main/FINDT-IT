"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { armAlertSoundUnlock, playCustomerAlert } from "@/lib/alert-sound";
import { showBrowserNotification } from "@/lib/browser-notify";
import { createClient } from "@/lib/supabase/client";

/**
 * Live in-app toast (and optional browser notification) when a store answers.
 */
export function CustomerAlertListener({ userId }: { userId: string }) {
  useEffect(() => {
    armAlertSoundUnlock();
  }, []);

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
          .channel(`customer-alerts:${userId}`)
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
              const body = row.body || "A store answered your Find.";
              const url = row.related_request_id
                ? `/requests/${row.related_request_id}`
                : "/notifications";
              toast.success(title, { description: body, duration: 12000 });
              playCustomerAlert();
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
        // Keep polling fallback on Alerts
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [userId]);

  return null;
}
