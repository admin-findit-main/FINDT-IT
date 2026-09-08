import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { boundUuid } from "@findit/domain";
import { getSupabasePublishableKey } from "@/lib/config/env";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  signRequestImageUrl,
  signRequestImageUrls,
} from "@/lib/services/request-images-server";

export const runtime = "nodejs";

type Mode = "queue" | "detail" | "activity";

function safeRequest(
  request: Record<string, unknown>,
  signedImageUrl: string | null
) {
  return {
    id: String(request.id || ""),
    product_name: String(request.product_name || ""),
    description:
      typeof request.description === "string" ? request.description : null,
    image_url: signedImageUrl,
    category: typeof request.category === "string" ? request.category : null,
    city: String(request.city || ""),
    state: String(request.state || ""),
    postal_code: String(request.postal_code || "").slice(0, 3),
    status: String(request.status || ""),
    expires_at: String(request.expires_at || ""),
    created_at: String(request.created_at || ""),
  };
}

async function authenticatedUser(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = getSupabasePublishableKey();
  if (!token || !url || !publishable) return null;
  const client = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  let body: { mode?: unknown; storeId?: unknown; requestId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const mode = body.mode as Mode;
  const storeId = boundUuid(
    typeof body.storeId === "string" ? body.storeId : ""
  );
  const requestId = boundUuid(
    typeof body.requestId === "string" ? body.requestId : ""
  );
  if (
    !storeId ||
    !["queue", "detail", "activity"].includes(mode) ||
    (mode === "detail" && !requestId)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const limited = await consumeRateLimit({
    bucket: "store-mobile-read",
    limit: 180,
    windowMs: 60_000,
    key: `${user.id}:${storeId}`,
  });
  if (!limited.ok) {
    return NextResponse.json({ error: limited.error }, { status: 429 });
  }

  const admin = createServiceClient();
  const [{ data: member }, { data: profile }] = await Promise.all([
    admin
      .from("store_members")
      .select("id")
      .eq("store_id", storeId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    admin
      .from("profiles")
      .select("is_suspended")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  if (!member || profile?.is_suspended) {
    return NextResponse.json({ error: "Store access denied" }, { status: 403 });
  }

  if (mode === "activity") {
    const { data } = await admin
      .from("store_responses")
      .select(
        "id, request_id, store_id, response_type, price, note, created_at, request:customer_requests(product_name)"
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(40);
    return NextResponse.json({ data: data || [] });
  }

  if (mode === "detail" && requestId) {
    const [{ data: target }, { data: requestRow }, { data: response }] =
      await Promise.all([
        admin
          .from("request_targets")
          .select(
            "id, request_id, store_id, delivery_status, viewed_at, opened_at, responded_at, created_at"
          )
          .eq("request_id", requestId)
          .eq("store_id", storeId)
          .maybeSingle(),
        admin
          .from("customer_requests")
          .select(
            "id, customer_id, product_name, description, image_url, image_storage_path, category, city, state, postal_code, status, expires_at, created_at"
          )
          .eq("id", requestId)
          .maybeSingle(),
        admin
          .from("store_responses")
          .select("*")
          .eq("request_id", requestId)
          .eq("store_id", storeId)
          .maybeSingle(),
      ]);
    if (!target || !requestRow) {
      return NextResponse.json({ data: null });
    }
    const imageValue =
      requestRow.image_storage_path || requestRow.image_url || null;
    const imageUrl = await signRequestImageUrl(
      imageValue,
      requestRow.customer_id
    );
    const now = new Date().toISOString();
    await admin
      .from("request_targets")
      .update({
        opened_at: target.opened_at || now,
        viewed_at: now,
      })
      .eq("id", target.id)
      .eq("store_id", storeId);
    return NextResponse.json({
      data: {
        request: safeRequest(requestRow, imageUrl),
        target,
        response: response || null,
      },
    });
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [{ data: targets }, { data: responses }] = await Promise.all([
    admin
      .from("request_targets")
      .select(
        "id, request_id, store_id, delivery_status, viewed_at, opened_at, responded_at, created_at, request:customer_requests(id, customer_id, product_name, description, image_url, image_storage_path, category, city, state, postal_code, status, expires_at, created_at)"
      )
      .eq("store_id", storeId)
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("store_responses")
      .select("request_id, response_type")
      .eq("store_id", storeId)
      .gte("created_at", start.toISOString()),
  ]);
  const responseByRequest = new Map(
    (responses || []).map((response) => [
      response.request_id,
      response.response_type,
    ])
  );
  const imageValues = (targets || []).map((target) => {
    const requestRow = Array.isArray(target.request)
      ? target.request[0]
      : target.request;
    return {
      value: requestRow?.image_storage_path || requestRow?.image_url || null,
      customerId: requestRow?.customer_id || "",
    };
  });
  const signedImages = await signRequestImageUrls(imageValues);
  const rows = (targets || [])
    .map((target) => {
      const requestRow = Array.isArray(target.request)
        ? target.request[0]
        : target.request;
      if (!requestRow) return null;
      if (
        ["cancelled", "expired", "fulfilled"].includes(requestRow.status) ||
        new Date(requestRow.expires_at).getTime() < Date.now()
      ) {
        return null;
      }
      const imageValue =
        requestRow.image_storage_path || requestRow.image_url || null;
      return {
        targetId: target.id,
        request: safeRequest(
          requestRow,
          imageValue ? signedImages.get(imageValue) || null : null
        ),
        responseType: responseByRequest.get(requestRow.id) || null,
        created_at: target.created_at,
      };
    })
    .filter(Boolean);
  return NextResponse.json({ data: rows });
}
