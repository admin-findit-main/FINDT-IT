"use client";

import { registerPushToken } from "@findit/supabase-client";
import { createClient } from "@/lib/supabase/client";

function vapidPublicKey(): string {
  return process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || "";
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  return Boolean(standalone);
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    // ready() still resolves if an earlier registration succeeded.
  }
  return navigator.serviceWorker.ready;
}

export async function subscribeWebPush(): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") return { ok: false, error: "unsupported" };
  if (!vapidPublicKey()) return { ok: false, error: "missing-vapid" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "unsupported" };
  }
  if (Notification.permission !== "granted") {
    return { ok: false, error: "permission" };
  }
  if (isIosDevice() && !isStandaloneDisplay()) {
    return { ok: false, error: "ios-homescreen" };
  }

  try {
    const registration = await getPushRegistration();
    if (!registration) return { ok: false, error: "unsupported" };
    const key = urlBase64ToUint8Array(vapidPublicKey());
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
    }

    const supabase = createClient();
    const result = await registerPushToken(supabase, {
      token: JSON.stringify(subscription.toJSON()),
      platform: "web",
      appSurface: "web",
    });
    if ("error" in result) {
      console.error("[FINDIT] push token save failed", result.error);
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "subscribe-failed";
    console.error("[FINDIT] web push subscribe failed", message);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      await existing?.unsubscribe();
    } catch {
      // Ignore cleanup failures and report the original error.
    }
    return { ok: false, error: message };
  }
}
