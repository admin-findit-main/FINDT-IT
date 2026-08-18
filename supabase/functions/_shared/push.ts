type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: Record<string, string>;
};

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (!messages.length) return;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[push] Expo send failed", res.status, text.slice(0, 400));
    }
  } catch (err) {
    console.error("[push] send failed", err);
  }
}
