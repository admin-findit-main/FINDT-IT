import { isExpoPushToken, sendWebPush } from "@/lib/services/web-push";

type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: Record<string, string>;
  channelId?: string;
  priority?: "default" | "normal" | "high";
};

type TokenRow = { token: string };

type TokenQuery = {
  select: (columns: string) => TokenQuery;
  eq: (column: string, value: string) => TokenQuery;
  in: (column: string, values: string[]) => TokenQuery;
  delete: () => TokenQuery;
  then: (
    resolve: (value: { data: TokenRow[] | null }) => void
  ) => Promise<{ data: TokenRow[] | null }>;
};

function asTokenTable(admin: {
  from: (table: string) => unknown;
}): TokenQuery {
  return admin.from("device_push_tokens") as TokenQuery;
}

export async function sendExpoPush(
  messages: ExpoPushMessage[],
  options?: { onGoneToken?: (token: string) => Promise<void> }
): Promise<void> {
  if (!messages.length) return;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  const accessToken =
    process.env.EXPO_ACCESS_TOKEN || process.env.EXPO_PUSH_ACCESS_TOKEN;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers,
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[FINDIT] Expo push failed", res.status, text.slice(0, 400));
        continue;
      }
      if (!options?.onGoneToken) continue;
      const json = (await res.json().catch(() => null)) as {
        data?: Array<{ status?: string; details?: { error?: string } }>;
      } | null;
      const tickets = json?.data || [];
      await Promise.all(
        tickets.map(async (ticket, index) => {
          if (
            ticket.status === "error" &&
            ticket.details?.error === "DeviceNotRegistered"
          ) {
            const token = chunk[index]?.to;
            if (token) await options.onGoneToken?.(token);
          }
        })
      );
    } catch (err) {
      console.error("[FINDIT] Expo push send failed", err);
    }
  }
}

export async function notifyCustomerDevices(input: {
  admin: { from: (table: string) => unknown };
  customerId: string;
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<void> {
  const table = asTokenTable(input.admin);
  const { data: tokens } = await table
    .select("token")
    .eq("user_id", input.customerId)
    .in("app_surface", ["customer", "web"]);
  if (!tokens?.length) {
    console.warn("[FINDIT] no customer push tokens", input.customerId.slice(0, 8));
    return;
  }

  const expoTokens = tokens
    .map((row) => row.token)
    .filter((token) => isExpoPushToken(token));
  const webTokens = tokens
    .map((row) => row.token)
    .filter((token) => !isExpoPushToken(token));

  await Promise.all([
    sendExpoPush(
      expoTokens.map((token) => ({
        to: token,
        sound: "default",
        title: input.title,
        body: input.body,
        data: input.data,
        channelId: "findit-alerts",
        priority: "high",
      }))
    ),
    sendWebPush({
      tokens: webTokens,
      title: input.title,
      body: input.body,
      data: input.data,
      onGoneToken: async (token) => {
        await asTokenTable(input.admin).delete().eq("token", token);
      },
    }),
  ]);
}

export async function notifyEmployeeDevices(input: {
  admin: { from: (table: string) => unknown };
  userIds: string[];
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<void> {
  const ids = [...new Set(input.userIds.filter(Boolean))];
  if (!ids.length) return;
  const { data: tokens } = await asTokenTable(input.admin)
    .select("token")
    .in("user_id", ids)
    .in("app_surface", ["employee", "web"]);
  if (!tokens?.length) return;

  const expoTokens = tokens
    .map((row) => row.token)
    .filter((token) => isExpoPushToken(token));
  const webTokens = tokens
    .map((row) => row.token)
    .filter((token) => !isExpoPushToken(token));

  await Promise.all([
    sendExpoPush(
      expoTokens.map((token) => ({
        to: token,
        sound: "default",
        title: input.title,
        body: input.body,
        data: input.data,
        channelId: "findit-alerts",
        priority: "high",
      }))
    ),
    sendWebPush({
      tokens: webTokens,
      title: input.title,
      body: input.body,
      data: {
        ...input.data,
        url: input.data.url || "/store",
      },
      onGoneToken: async (token) => {
        await asTokenTable(input.admin).delete().eq("token", token);
      },
    }),
  ]);
}
