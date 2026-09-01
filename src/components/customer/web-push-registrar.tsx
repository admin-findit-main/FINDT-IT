"use client";

import { useEffect } from "react";
import { browserNotifyPermission } from "@/lib/browser-notify";
import { subscribeWebPush } from "@/lib/web-push-client";

/** Re-subscribes this phone so store replies still arrive after FINDIT is closed. */
export function WebPushRegistrar() {
  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (browserNotifyPermission() !== "granted") return;
      const result = await subscribeWebPush();
      if (!cancelled && !result.ok) {
        console.error("[FINDIT] web push registrar", result.error);
      }
    }

    void sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);
  return null;
}
