"use client";

import { useEffect } from "react";
import { capturePwaInstallEvents } from "@/lib/pwa-install";

export function RegisterSW() {
  useEffect(() => {
    capturePwaInstallEvents();
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Optional — ignore registration failures in local/dev.
    });
  }, []);
  return null;
}
