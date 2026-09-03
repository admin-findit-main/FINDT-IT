import {
  isAdminPushAudience,
  parseAdminPushCopy,
  type AdminPushAudience,
} from "@findit/domain";
import { isExpoPushToken, sendWebPush } from "@/lib/services/web-push";
import { sendExpoPush } from "@/lib/services/expo-push";

type ServiceAdmin = {
  from: (table: string) => any;
};

type TokenRow = { token: string; user_id: string };

const IN_CHUNK = 200;

function vapidReady() {
  return Boolean(
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY &&
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY
  );
}

async function rowsIn<T>(
  query: PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const { data } = await query;
  return data || [];
}

async function activeIdsFor(
  admin: ServiceAdmin,
  ids: string[]
): Promise<string[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const active: string[] = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const slice = unique.slice(i, i + IN_CHUNK);
    const rows = await rowsIn<{ id: string }>(
      admin.from("profiles").select("id").in("id", slice).eq("is_suspended", false)
    );
    active.push(...rows.map((row) => row.id));
  }
  return active;
}

async function tokensForUsers(
  admin: ServiceAdmin,
  userIds: string[]
): Promise<TokenRow[]> {
  if (!userIds.length) return [];
  const tokens: TokenRow[] = [];
  for (let i = 0; i < userIds.length; i += IN_CHUNK) {
    const slice = userIds.slice(i, i + IN_CHUNK);
    const rows = await rowsIn<TokenRow>(
      admin.from("device_push_tokens").select("token, user_id").in("user_id", slice)
    );
    tokens.push(...rows);
  }
  return tokens;
}

async function audienceUserIds(
  admin: ServiceAdmin,
  audience: AdminPushAudience
): Promise<string[]> {
  if (audience === "all") {
    const rows = await rowsIn<{ id: string }>(
      admin.from("profiles").select("id").eq("is_suspended", false)
    );
    return rows.map((row) => row.id);
  }

  if (audience === "shoppers") {
    const rows = await rowsIn<{ id: string }>(
      admin
        .from("profiles")
        .select("id")
        .eq("account_type", "customer")
        .eq("is_suspended", false)
    );
    return rows.map((row) => row.id);
  }

  if (audience === "store_owners") {
    const [stores, members] = await Promise.all([
      rowsIn<{ owner_id: string | null }>(admin.from("stores").select("owner_id")),
      rowsIn<{ user_id: string }>(
        admin
          .from("store_members")
          .select("user_id")
          .eq("role", "owner")
          .eq("status", "active")
      ),
    ]);
    const ids = new Set<string>();
    for (const row of stores) {
      if (row.owner_id) ids.add(row.owner_id);
    }
    for (const row of members) {
      if (row.user_id) ids.add(row.user_id);
    }
    return activeIdsFor(admin, [...ids]);
  }

  const members = await rowsIn<{ user_id: string }>(
    admin
      .from("store_members")
      .select("user_id")
      .in("role", ["employee", "manager"])
      .eq("status", "active")
  );
  return activeIdsFor(
    admin,
    members.map((row) => row.user_id)
  );
}

export async function countPushAudience(
  admin: ServiceAdmin,
  audience: AdminPushAudience
): Promise<{ people: number; devices: number }> {
  const userIds = await audienceUserIds(admin, audience);
  const tokens = await tokensForUsers(admin, userIds);
  const people = new Set(tokens.map((row) => row.user_id)).size;
  return { people, devices: tokens.length };
}

export async function deliverAdminPush(input: {
  admin: ServiceAdmin;
  audience: AdminPushAudience;
  title: string;
  body: string;
  url: string;
}): Promise<{ recipients: number; pruned: number }> {
  const userIds = await audienceUserIds(input.admin, input.audience);
  const rows = await tokensForUsers(input.admin, userIds);
  if (!rows.length) return { recipients: 0, pruned: 0 };

  const uniqueTokens = [...new Set(rows.map((row) => row.token))];
  const gone = new Set<string>();
  const prune = async (token: string) => {
    gone.add(token);
    await input.admin.from("device_push_tokens").delete().eq("token", token);
  };

  const expoTokens = uniqueTokens.filter((token) => isExpoPushToken(token));
  const webTokens = uniqueTokens.filter((token) => !isExpoPushToken(token));

  await Promise.all([
    sendExpoPush(
      expoTokens.map((token) => ({
        to: token,
        sound: "default",
        title: input.title,
        body: input.body,
        data: { type: "admin_broadcast", url: input.url },
        channelId: "findit-alerts",
        priority: "high",
      })),
      { onGoneToken: prune }
    ),
    sendWebPush({
      tokens: webTokens,
      title: input.title,
      body: input.body,
      data: { type: "admin_broadcast", url: input.url, tag: "admin-broadcast" },
      onGoneToken: prune,
    }),
  ]);

  const inboxRows = userIds.map((userId) => ({
    user_id: userId,
    type: "admin_broadcast",
    title: input.title,
    body: input.body,
    related_request_id: null,
    related_store_id: null,
  }));
  for (let i = 0; i < inboxRows.length; i += IN_CHUNK) {
    await input.admin.from("notifications").insert(inboxRows.slice(i, i + IN_CHUNK));
  }

  return {
    recipients: uniqueTokens.length,
    pruned: gone.size,
  };
}

export function assertAdminPushReady(): string | null {
  if (!vapidReady()) {
    return "Web push is not configured. Set the VAPID keys, then try again.";
  }
  return null;
}

export { isAdminPushAudience, parseAdminPushCopy };
