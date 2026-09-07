import { invokeRespondToRequest } from "@findit/supabase-client";
import { supabase } from "./supabase";

type SafeStoreRequest = {
  id: string;
  product_name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  city: string;
  state: string;
  postal_code: string;
  status: string;
  expires_at: string;
  created_at: string;
};

type StoreQueueItem = {
  targetId: string;
  request: SafeStoreRequest;
  responseType: string | null;
  created_at: string;
};

type StoreRequestDetail = {
  request: SafeStoreRequest;
  target: Record<string, unknown>;
  response: {
    response_type: string;
    [key: string]: unknown;
  } | null;
};

type StoreActivityItem = {
  id: string;
  response_type: string;
  created_at: string;
  request?: { product_name?: string } | { product_name?: string }[] | null;
};

async function fetchStoreMobileData<T>(
  mode: "queue" | "detail" | "activity",
  storeId: string,
  requestId?: string
): Promise<T | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  const origin = (
    process.env.EXPO_PUBLIC_APP_URL || "https://store.askfindit.com"
  ).replace(/\/$/, "");
  const response = await fetch(`${origin}/api/store/mobile-data`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode, storeId, requestId }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: T };
  return body.data ?? null;
}

export async function fetchStoreQueue(storeId: string) {
  return (
    (await fetchStoreMobileData<StoreQueueItem[]>("queue", storeId)) || []
  );
}

export async function fetchRequestForStore(requestId: string, storeId: string) {
  return fetchStoreMobileData<StoreRequestDetail>(
    "detail",
    storeId,
    requestId
  );
}

export async function respondToRequest(input: {
  requestId: string;
  storeId: string;
  responseType: "in_stock" | "out_of_stock" | "can_order";
  price?: number | null;
  note?: string;
  holdMinutes?: number | null;
  estimatedAvailabilityLabel?: string;
  availabilityAmount?: "plenty" | "few_left" | "last_one" | null;
}) {
  return invokeRespondToRequest(supabase, input);
}

export function subscribeStoreInbox(storeId: string, onChange: () => void) {
  void supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token && typeof supabase.realtime.setAuth === "function") {
      void supabase.realtime.setAuth(session.access_token);
    }
  });
  const channel = supabase
    .channel(`employee-inbox:${storeId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "request_targets",
        filter: `store_id=eq.${storeId}`,
      },
      () => onChange()
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "store_responses",
        filter: `store_id=eq.${storeId}`,
      },
      () => onChange()
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function deleteMyAccount(confirmation: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: "Please sign in" };
  const origin = (process.env.EXPO_PUBLIC_APP_URL || "https://store.askfindit.com").replace(
    /\/$/,
    ""
  );
  const response = await fetch(`${origin}/api/account/delete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirmation }),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) return { error: body.error || "Could not delete this account." };
  return { ok: true as const };
}

export async function fetchActivity(storeId: string) {
  return (
    (await fetchStoreMobileData<StoreActivityItem[]>("activity", storeId)) || []
  );
}
