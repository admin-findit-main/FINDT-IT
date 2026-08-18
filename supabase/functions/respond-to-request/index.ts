import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.2";
import {
  corsHeaders,
  deriveRequestStatus,
  jsonResponse,
  responseTimeSeconds,
} from "../_shared/domain.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401, origin);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, origin);
  }

  const requestId = String(body.requestId || "");
  const storeId = String(body.storeId || "");
  const responseType = String(body.responseType || "") as
    | "in_stock"
    | "out_of_stock"
    | "can_order";

  if (!requestId || !storeId) {
    return jsonResponse({ error: "requestId and storeId required" }, 400, origin);
  }
  if (!["in_stock", "out_of_stock", "can_order"].includes(responseType)) {
    return jsonResponse({ error: "Invalid responseType" }, 400, origin);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, account_type")
    .eq("id", user.id)
    .single();

  const { data: membership } = await admin
    .from("store_members")
    .select("id, role, status")
    .eq("store_id", storeId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership && profile?.account_type !== "admin") {
    return jsonResponse({ error: "Not a store member" }, 403, origin);
  }

  const { data: target } = await admin
    .from("request_targets")
    .select("*")
    .eq("request_id", requestId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!target) {
    return jsonResponse({ error: "Request was not sent to this store" }, 404, origin);
  }

  const { data: requestRow } = await admin
    .from("customer_requests")
    .select(
      "id, status, expires_at, customer_id, product_name, stores_targeted"
    )
    .eq("id", requestId)
    .single();
  if (!requestRow) {
    return jsonResponse({ error: "Request not found" }, 404, origin);
  }
  if (requestRow.status === "cancelled" || requestRow.status === "fulfilled") {
    return jsonResponse(
      { error: "This request is no longer accepting responses" },
      400,
      origin
    );
  }
  if (
    requestRow.status === "expired" ||
    new Date(requestRow.expires_at).getTime() < Date.now()
  ) {
    return jsonResponse({ error: "This request has expired" }, 400, origin);
  }

  const { data: existing } = await admin
    .from("store_responses")
    .select("id")
    .eq("request_id", requestId)
    .eq("store_id", storeId)
    .maybeSingle();

  const respondedAt = new Date().toISOString();
  const payload = {
    request_id: requestId,
    store_id: storeId,
    responded_by: user.id,
    response_type: responseType,
    price: body.price != null ? Number(body.price) : null,
    quantity: body.quantity != null ? Number(body.quantity) : null,
    note: body.note ? String(body.note) : null,
    hold_minutes: body.holdMinutes != null ? Number(body.holdMinutes) : null,
    estimated_availability_label: body.estimatedAvailabilityLabel
      ? String(body.estimatedAvailabilityLabel)
      : null,
    availability_amount: body.availabilityAmount ?? null,
    track_demand: Boolean(body.trackDemand),
    updated_at: respondedAt,
  };

  const { data, error } = existing
    ? await admin
        .from("store_responses")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()
    : await admin.from("store_responses").insert(payload).select("*").single();

  if (error || !data) {
    return jsonResponse(
      { error: "Couldn't save your response. Please try again." },
      500,
      origin
    );
  }

  const secs = responseTimeSeconds(
    target.route_sent_at || target.created_at,
    respondedAt
  );
  await admin
    .from("request_targets")
    .update({
      responded_at: respondedAt,
      response_time_seconds: secs,
      opened_at: target.opened_at || respondedAt,
      viewed_at: target.viewed_at || respondedAt,
    })
    .eq("id", target.id);

  const { count } = await admin
    .from("store_responses")
    .select("*", { count: "exact", head: true })
    .eq("request_id", requestId);

  const status = deriveRequestStatus({
    responseCount: count || 0,
    targetCount: requestRow.stores_targeted || 0,
  });
  await admin.from("customer_requests").update({ status }).eq("id", requestId);

  if (responseType === "in_stock" || responseType === "can_order") {
    const { data: store } = await admin
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .single();
    await admin.from("notifications").insert({
      user_id: requestRow.customer_id,
      type: responseType,
      title:
        responseType === "in_stock"
          ? `${store?.name || "A store"} has it in stock`
          : `${store?.name || "A store"} can order it`,
      body: `${requestRow.product_name}`,
      related_request_id: requestId,
      related_store_id: storeId,
    });

    // Stub customer push
    const { data: tokens } = await admin
      .from("device_push_tokens")
      .select("token")
      .eq("user_id", requestRow.customer_id)
      .eq("app_surface", "customer");
    const expoToken = Deno.env.get("EXPO_ACCESS_TOKEN");
    if (tokens?.length && expoToken) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${expoToken}`,
        },
        body: JSON.stringify(
          tokens.map((t) => ({
            to: t.token,
            sound: "default",
            title:
              responseType === "in_stock"
                ? "In stock nearby"
                : "A store can order it",
            body: requestRow.product_name,
            data: { type: responseType, requestId },
          }))
        ),
      });
    } else if (tokens?.length) {
      console.log(
        `[push stub] Would notify customer ${tokens.length} device(s)`
      );
    }
  }

  await admin.from("analytics_events").insert({
    event_name: "store_response_created",
    user_id: user.id,
    store_id: storeId,
    request_id: requestId,
    metadata: { responseType, responseTimeSeconds: secs },
  });

  return jsonResponse({ response: data }, 200, origin);
});
