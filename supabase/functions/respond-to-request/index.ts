import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.2";
import {
  corsHeaders,
  jsonResponse,
} from "../_shared/domain.ts";
import { customerReplyPushCopy, notifyCustomerPush } from "../_shared/push.ts";

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

  const { data, error } = await admin
    .rpc("respond_to_store_request", {
      p_request_id: requestId,
      p_store_id: storeId,
      p_response_type: responseType,
      p_employee_user_id: user.id,
      p_shift_employee_id: null,
      p_hub_device_id: null,
      p_price: body.price != null ? Number(body.price) : null,
      p_quantity: body.quantity != null ? Number(body.quantity) : null,
      p_note: body.note ? String(body.note) : null,
      p_hold_minutes:
        body.holdMinutes != null ? Number(body.holdMinutes) : null,
      p_estimated_available_at: null,
      p_estimated_availability_label: body.estimatedAvailabilityLabel
        ? String(body.estimatedAvailabilityLabel)
        : null,
      p_availability_amount: body.availabilityAmount ?? null,
      p_track_demand: Boolean(body.trackDemand),
    });
  const rpcRow = Array.isArray(data) ? data[0] : data;

  if (error || !rpcRow) {
    return jsonResponse(
      { error: "Couldn't save your response. Please try again." },
      500,
      origin
    );
  }

  if (rpcRow.notify_customer) {
    const { data: store } = await admin
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .single();
    const { data: customer } = await admin
      .from("profiles")
      .select("notify_in_stock, notify_can_order")
      .eq("id", requestRow.customer_id)
      .maybeSingle();
    const wantsAlert =
      responseType === "in_stock"
        ? customer?.notify_in_stock !== false
        : customer?.notify_can_order !== false;
    if (wantsAlert) {
      const storeName = store?.name || "A store";
      const copy =
        customerReplyPushCopy({
          responseType,
          productName: requestRow.product_name,
          storeName,
        }) || {
          title:
            responseType === "in_stock"
              ? `${storeName} has it in stock`
              : `${storeName} can order it`,
          body: `${requestRow.product_name}`,
        };
      const notifyTask = Promise.all([
        admin.from("notifications").insert({
          user_id: requestRow.customer_id,
          type: responseType,
          title:
            responseType === "in_stock"
              ? `${storeName} has it in stock`
              : `${storeName} can order it`,
          body: `${requestRow.product_name}`,
          related_request_id: requestId,
          related_store_id: storeId,
        }),
        notifyCustomerPush({
          admin,
          customerId: requestRow.customer_id,
          title: copy.title,
          body: copy.body,
          data: {
            type: responseType,
            requestId,
            storeId,
            url: `/requests/${requestId}`,
          },
        }),
      ]).catch((err) => {
        console.error("[FINDIT] Customer notify failed", err);
      });
      const runtime = (
        globalThis as {
          EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
        }
      ).EdgeRuntime;
      if (runtime?.waitUntil) runtime.waitUntil(notifyTask);
      else await notifyTask;
    }
  }

  if (rpcRow.created_new) {
    const analyticsTask = admin.from("analytics_events").insert({
      event_name: "store_response_created",
      user_id: user.id,
      store_id: storeId,
      request_id: requestId,
      metadata: { responseType },
    });
    const runtime = (
      globalThis as {
        EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
      }
    ).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(analyticsTask);
    else await analyticsTask;
  }

  const response: Record<string, unknown> = {
    ...rpcRow,
    id: rpcRow.response_id,
  };
  delete response.response_id;
  delete response.created_new;
  delete response.notify_customer;
  delete response.final_request_status;
  return jsonResponse({ response }, 200, origin);
});
