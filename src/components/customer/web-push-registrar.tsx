"use client";

import { useEffect } from "react";
import { browserNotifyPermission } from "@/lib/browser-notify";
import { subscribeWebPush } from "@/lib/web-push-client";

/** Re-subscribes this phone so store replies still arrive after FINDIT is closed. */
export function WebPushRegistrar() {
  useEffect(() => {
    if (browserNotifyPermission() !== "granted") return;
    void subscribeWebPush();
  }, []);
  return null;
}
