import { invokeRespondToRequest } from "@findit/supabase-client";
import { supabase } from "./supabase";

export async function fetchStoreQueue(storeId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { data: targets } = await supabase
    .from("request_targets")
    .select("*, request:customer_requests(*)")
    .eq("store_id", storeId)
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false });

  const { data: responses } = await supabase
    .from("store_responses")
    .select("request_id, response_type")
    .eq("store_id", storeId);

  const responded = new Map(
    (responses || []).map((r) => [r.request_id, r.response_type])
  );

  return (targets || [])
    .map((t: Record<string, unknown>) => {
      const request = Array.isArray(t.request) ? t.request[0] : t.request;
      if (!request || typeof request !== "object") return null;
      const req = request as {
        id: string;
        product_name: string;
        description: string | null;
        image_url: string | null;
        category: string | null;
        city: string;
        status: string;
        expires_at: string;
        created_at: string;
      };
      if (["cancelled", "expired", "fulfilled"].includes(req.status)) return null;
      if (new Date(req.expires_at).getTime() < Date.now()) return null;
      return {
        targetId: t.id as string,
        request: req,
        responseType: responded.get(req.id) || null,
        created_at: t.created_at as string,
      };
    })
    .filter(Boolean);
}

export async function fetchRequestForStore(requestId: string, storeId: string) {
  const { data: target } = await supabase
    .from("request_targets")
    .select("*")
    .eq("request_id", requestId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!target) return null;

  const { data: request } = await supabase
    .from("customer_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!request) return null;

  const { data: response } = await supabase
    .from("store_responses")
    .select("*")
    .eq("request_id", requestId)
    .eq("store_id", storeId)
    .maybeSingle();

  await supabase
    .from("request_targets")
    .update({
      opened_at: target.opened_at || new Date().toISOString(),
      viewed_at: new Date().toISOString(),
    })
    .eq("id", target.id);

  return { request, target, response };
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

export async function fetchActivity(storeId: string) {
  const { data } = await supabase
    .from("store_responses")
    .select("*, request:customer_requests(product_name)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(40);
  return data || [];
}
