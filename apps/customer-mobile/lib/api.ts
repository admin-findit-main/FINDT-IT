import { invokeCreateAndRouteRequest } from "@findit/supabase-client";
import type { CreateRequestInput } from "@findit/domain";
import { supabase } from "./supabase";

export async function createAndRouteRequest(input: CreateRequestInput) {
  return invokeCreateAndRouteRequest(supabase, input);
}

export async function fetchMyRequests(tab: "active" | "past") {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  let query = supabase.from("customer_requests").select("*").eq("customer_id", user.id);
  if (tab === "active") {
    query = query.in("status", ["active", "partially_answered", "answered", "draft"]);
  } else {
    query = query.in("status", ["expired", "cancelled", "fulfilled"]);
  }
  const { data } = await query.order("created_at", { ascending: false });
  return data || [];
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
