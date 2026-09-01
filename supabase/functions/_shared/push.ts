type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: Record<string, string>;
  channelId?: string;
  priority?: "high" | "normal" | "default";
};

export function customerReplyPushCopy(input: {
  responseType: string;
  productName: string;
  storeName?: string | null;
}): { title: string; body: string } | null {
  const store = (input.storeName || "a nearby store").trim() || "a nearby store";
  const product = input.productName.trim() || "your Find";
  if (input.responseType === "in_stock") {
    return {
      title: "Your product has been found",
      body: `at ${store}`,
    };
  }
  if (input.responseType === "can_order") {
    return {
      title: `${store} can order it`,
      body: product,
    };
  }
  return null;
}

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

export async function deliverCustomerPush(input: {
  customerId: string;
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<boolean> {
  return deliverPush({
    customerId: input.customerId,
    title: input.title,
    body: input.body,
    data: input.data,
  });
}

export async function deliverStorePush(input: {
  userIds: string[];
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<boolean> {
  return deliverPush({
    userIds: input.userIds,
    title: input.title,
    body: input.body,
    data: input.data,
  });
}

async function deliverPush(input: {
  customerId?: string;
  userIds?: string[];
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<boolean> {
  const secret = Deno.env.get("PUSH_INTERNAL_SECRET");
  if (!secret) return false;
  const url =
    Deno.env.get("FINDIT_PUSH_DELIVER_URL") ||
    "https://dashboard.askfindit.com/api/push/deliver";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[push] deliver failed", res.status, text.slice(0, 400));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[push] deliver failed", err);
    return false;
  }
}

export async function notifyCustomerPush(input: {
  admin: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string
        ) => {
          in: (
            column: string,
            values: string[]
          ) => Promise<{ data: { token: string }[] | null }>;
        };
      };
    };
  };
  customerId: string;
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<void> {
  const delivered = await deliverCustomerPush({
    customerId: input.customerId,
    title: input.title,
    body: input.body,
    data: input.data,
  });
  if (delivered) return;

  const { data: tokens } = await input.admin
    .from("device_push_tokens")
    .select("token")
    .eq("user_id", input.customerId)
    .in("app_surface", ["customer", "web"]);
  if (!tokens?.length) return;
  await sendExpoPush(
    tokens
      .filter((row) => row.token.startsWith("ExponentPushToken[") || row.token.startsWith("ExpoPushToken["))
      .map((row) => ({
        to: row.token,
        sound: "default",
        title: input.title,
        body: input.body,
        data: input.data,
        channelId: "findit-alerts",
        priority: "high",
      }))
  );
}
