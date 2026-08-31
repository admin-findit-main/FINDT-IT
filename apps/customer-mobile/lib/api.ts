import { invokeCreateAndRouteRequest } from "@findit/supabase-client";
import {
  canRebroadcastStillLooking,
  getConsumerEntitlements,
  monthlyFindWindowStart,
  type CreateRequestInput,
} from "@findit/domain";
import type { CustomerRequest } from "@findit/types";
import { supabase } from "./supabase";

export async function createAndRouteRequest(input: CreateRequestInput) {
  return invokeCreateAndRouteRequest(supabase, input);
}

export async function fetchMyRequests(tab: "active" | "past" | "saved") {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  if (tab === "saved") {
    const { data } = await supabase
      .from("saved_requests")
      .select("request:customer_requests(*)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    return ((data || [])
      .map((row: { request?: CustomerRequest | CustomerRequest[] | null }) => row.request)
      .flat()
      .filter(Boolean) as CustomerRequest[]);
  }
  let query = supabase.from("customer_requests").select("*").eq("customer_id", user.id);
  if (tab === "active") {
    query = query.in("status", ["active", "partially_answered", "answered", "draft"]);
  } else {
    query = query.in("status", ["expired", "cancelled", "fulfilled"]);
  }
  const { data } = await query.order("created_at", { ascending: false });
  return (data || []) as CustomerRequest[];
}

export async function fetchRequestDetail(requestId: string) {
  const { data: request } = await supabase
    .from("customer_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!request) return null;
  const { data: responses } = await supabase
    .from("store_responses")
    .select("*, store:stores(*)")
    .eq("request_id", requestId);
  return { ...request, responses: responses || [] };
}

export async function fetchPlanUsage() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_plan")
    .eq("id", user.id)
    .maybeSingle();
  const entitlements = getConsumerEntitlements(profile?.subscription_plan);
  const { count } = await supabase
    .from("customer_requests")
    .select("*", { count: "exact", head: true })
    .eq("customer_id", user.id)
    .gte("created_at", monthlyFindWindowStart().toISOString());
  const used = count || 0;
  return {
    entitlements,
    used,
    limit: entitlements.monthlyRequestLimit,
    remaining: Math.max(0, entitlements.monthlyRequestLimit - used),
  };
}

export async function fulfillRequest(input: {
  requestId: string;
  storeId?: string | null;
  foundWithFindit?: boolean | null;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in" };
  const { error } = await supabase
    .from("customer_requests")
    .update({
      status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
      fulfilled_store_id: input.storeId || null,
      found_with_findit: input.foundWithFindit ?? null,
    })
    .eq("id", input.requestId)
    .eq("customer_id", user.id);
  if (error) return { error: "Couldn't update this request." };
  return { ok: true as const };
}

export async function stillLooking(requestId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in" };
  const { data: request } = await supabase
    .from("customer_requests")
    .select("*")
    .eq("id", requestId)
    .eq("customer_id", user.id)
    .single();
  if (!request) return { error: "Request not found" };
  const check = canRebroadcastStillLooking({
    status: request.status,
    expiresAt: request.expires_at,
    stillLookingCount: request.still_looking_count || 0,
    lastRebroadcastAt: request.last_rebroadcast_at || null,
  });
  if (!check.ok) return { error: check.reason };
  const extended = new Date(
    Math.max(new Date(request.expires_at).getTime(), Date.now()) + 12 * 3600_000
  ).toISOString();
  const { error } = await supabase
    .from("customer_requests")
    .update({
      still_looking_count: (request.still_looking_count || 0) + 1,
      last_rebroadcast_at: new Date().toISOString(),
      expires_at: extended,
    })
    .eq("id", requestId)
    .eq("customer_id", user.id);
  if (error) return { error: "Couldn't update this request." };
  return { ok: true as const };
}

export async function cancelRequest(requestId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in" };
  const { error } = await supabase
    .from("customer_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("customer_id", user.id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function saveRequest(requestId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in" };
  const { error } = await supabase.from("saved_requests").upsert(
    {
      customer_id: user.id,
      request_id: requestId,
    },
    { onConflict: "customer_id,request_id" }
  );
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function fetchNotifications() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return data || [];
}

export async function updateMyProfile(input: {
  firstName?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  notifyInStock?: boolean;
  notifyCanOrder?: boolean;
  notifyRequestExpired?: boolean;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in" };
  const patch: Record<string, string | boolean> = {};
  if (input.firstName !== undefined) patch.first_name = input.firstName;
  if (input.city !== undefined) patch.default_city = input.city;
  if (input.state !== undefined) patch.default_state = input.state;
  if (input.postalCode !== undefined) patch.default_postal_code = input.postalCode;
  if (input.notifyInStock !== undefined) patch.notify_in_stock = input.notifyInStock;
  if (input.notifyCanOrder !== undefined) patch.notify_can_order = input.notifyCanOrder;
  if (input.notifyRequestExpired !== undefined) {
    patch.notify_request_expired = input.notifyRequestExpired;
  }
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function updateMyPlace(input: {
  city: string;
  state: string;
  postalCode: string;
}) {
  return updateMyProfile({
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
  });
}

export async function deleteMyAccount(confirmation: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: "Please sign in" };
  const origin = (process.env.EXPO_PUBLIC_APP_URL || "https://dashboard.askfindit.com").replace(
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

export async function markNotificationRead(id: string) {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
}

export function subscribeRequestRealtime(
  requestId: string,
  onChange: () => void
) {
  void supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token && typeof supabase.realtime.setAuth === "function") {
      void supabase.realtime.setAuth(session.access_token);
    }
  });
  const channel = supabase
    .channel(`mobile-request:${requestId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "store_responses",
        filter: `request_id=eq.${requestId}`,
      },
      () => onChange()
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "customer_requests",
        filter: `id=eq.${requestId}`,
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
