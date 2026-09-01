"use client";

export type BrowserNotifyPermission = NotificationPermission | "unsupported";

export function browserNotifyPermission(): BrowserNotifyPermission {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestBrowserNotifyPermission(): Promise<BrowserNotifyPermission> {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showBrowserNotification(input: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}): Promise<void> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const payload = {
    body: input.body,
    tag: input.tag || input.title,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: input.url || "/notifications" },
    requireInteraction: true,
    renotify: true,
    silent: false,
    vibrate: [200, 80, 200],
  };

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(input.title, payload);
      return;
    }
  } catch {
    // Fall through to the page Notification API.
  }

  const note = new Notification(input.title, payload);
  note.onclick = () => {
    window.focus();
    if (input.url) window.location.href = input.url;
    note.close();
  };
}
