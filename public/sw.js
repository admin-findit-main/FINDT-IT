self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("findit-offline-v1").then((cache) => cache.add("/offline.html"))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function sameOriginPath(raw, fallback) {
  const fallbackPath =
    typeof fallback === "string" &&
    fallback.startsWith("/") &&
    !fallback.startsWith("//")
      ? fallback
      : "/notifications";
  if (!raw || typeof raw !== "string") return fallbackPath;
  const trimmed = raw.trim();
  if (!trimmed) return fallbackPath;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.origin !== self.location.origin) return fallbackPath;
      const path = `${url.pathname}${url.search}${url.hash}` || "/";
      if (!path.startsWith("/") || path.startsWith("//")) return fallbackPath;
      return path;
    } catch {
      return fallbackPath;
    }
  }
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallbackPath;
  if (trimmed.includes("\\") || /[\s<>'"]/.test(trimmed)) return fallbackPath;
  return trimmed.slice(0, 500);
}

self.addEventListener("push", (event) => {
  event.waitUntil(showPushNotification(event));
});

async function showPushNotification(event) {
  let payload = {
    title: "FINDIT",
    body: "A store answered your Find.",
    url: "/notifications",
    tag: "findit",
    type: "",
    storeId: "",
    storeName: "",
    notificationId: "",
    requestId: "",
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || payload.body,
        url: sameOriginPath(parsed.url, payload.url),
        tag: parsed.tag || parsed.notificationId || parsed.url || payload.tag,
        type: typeof parsed.type === "string" ? parsed.type : "",
        storeId: typeof parsed.storeId === "string" ? parsed.storeId : "",
        storeName: typeof parsed.storeName === "string" ? parsed.storeName : "",
        notificationId:
          typeof parsed.notificationId === "string" ? parsed.notificationId : "",
        requestId:
          typeof parsed.requestId === "string" ? parsed.requestId : "",
      };
    }
  } catch {
    try {
      const text = event.data && event.data.text();
      if (text) payload.body = text;
    } catch {
      // Keep the fallback copy.
    }
  }

  await self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: {
      url: payload.url,
      type: payload.type,
      storeId: payload.storeId,
      storeName: payload.storeName,
      notificationId: payload.notificationId,
      requestId: payload.requestId,
    },
    tag: payload.tag,
    requireInteraction: true,
    renotify: true,
    silent: false,
    vibrate: [200, 80, 200, 80, 320],
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let target = sameOriginPath(data.url, "/notifications");
  if (
    (!data.url || data.url === "/notifications") &&
    data.notificationId &&
    typeof data.notificationId === "string"
  ) {
    target = `/notifications/${data.notificationId}`;
  } else if (
    data.requestId &&
    typeof data.requestId === "string" &&
    (!data.url || data.url === "/notifications")
  ) {
    target = `/requests/${data.requestId}`;
  }
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              // Some browsers only allow navigate on clients this SW created.
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match("/offline.html");
        if (cached) return cached;
        return new Response(
          "<!doctype html><title>FINDIT</title><p>FINDIT is offline.</p>",
          {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      })
    );
  }
});
