type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: Record<string, string>;
};

type TokenRow = { token: string };

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (!messages.length) return;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  const accessToken =
    process.env.EXPO_ACCESS_TOKEN || process.env.EXPO_PUSH_ACCESS_TOKEN;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[FINDIT] Expo push failed", res.status, text.slice(0, 400));
    }
  } catch (err) {
    console.error("[FINDIT] Expo push send failed", err);
  }
}

export async function notifyCustomerDevices(input: {
  // Service client; table is not in the generated Database type yet.
  admin: { from: (table: "device_push_tokens") => unknown };
  customerId: string;
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<void> {
  const query = input.admin.from("device_push_tokens") as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (
          column: string,
          value: string
        ) => Promise<{ data: TokenRow[] | null }>;
      };
    };
  };
  const { data: tokens } = await query
    .select("token")
    .eq("user_id", input.customerId)
    .eq("app_surface", "customer");
  if (!tokens?.length) return;
  await sendExpoPush(
    tokens.map((row) => ({
      to: row.token,
      sound: "default",
      title: input.title,
      body: input.body,
      data: input.data,
    }))
  );
}

export async function notifyEmployeeDevices(input: {
  admin: { from: (table: "device_push_tokens") => unknown };
  userIds: string[];
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<void> {
  const ids = [...new Set(input.userIds.filter(Boolean))];
  if (!ids.length) return;
  const query = input.admin.from("device_push_tokens") as {
    select: (columns: string) => {
      in: (column: string, values: string[]) => {
        eq: (
          column: string,
          value: string
        ) => Promise<{ data: TokenRow[] | null }>;
      };
    };
  };
  const { data: tokens } = await query
    .select("token")
    .in("user_id", ids)
    .eq("app_surface", "employee");
  if (!tokens?.length) return;
  await sendExpoPush(
    tokens.map((row) => ({
      to: row.token,
      sound: "default",
      title: input.title,
      body: input.body,
      data: input.data,
    }))
  );
}
