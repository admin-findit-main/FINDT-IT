import webpush from "web-push";

type WebSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function vapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY
  );
}

function applyVapid() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:hello@askfindit.com",
    publicKey,
    privateKey
  );
  return true;
}

export function parseWebPushSubscription(token: string): WebSubscription | null {
  const trimmed = token.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<WebSubscription>;
    if (
      typeof parsed.endpoint === "string" &&
      typeof parsed.keys?.p256dh === "string" &&
      typeof parsed.keys?.auth === "string"
    ) {
      return {
        endpoint: parsed.endpoint,
        keys: { p256dh: parsed.keys.p256dh, auth: parsed.keys.auth },
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function isExpoPushToken(token: string): boolean {
  return (
    token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")
  );
}

export async function sendWebPush(input: {
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, string>;
  onGoneToken?: (token: string) => Promise<void>;
}): Promise<void> {
  if (!input.tokens.length || !vapidConfigured() || !applyVapid()) return;

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.data.url || "/notifications",
    tag: input.data.requestId || input.data.url || "findit",
  });

  await Promise.all(
    input.tokens.map(async (token) => {
      const subscription = parseWebPushSubscription(token);
      if (!subscription) return;
      try {
        await webpush.sendNotification(subscription, payload, {
          TTL: 60 * 60 * 24,
          urgency: "high",
        });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await input.onGoneToken?.(token);
          return;
        }
        console.error("[FINDIT] Web push failed", status || err);
      }
    })
  );
}
