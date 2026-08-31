import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.2";
import {
  corsHeaders,
  deriveRequestStatus,
  isStoreOpenAt,
  jsonResponse,
  normalizeProductName,
  PRODUCT_CATEGORIES,
  isAgeRestrictedFind,
  AGE_RESTRICTED_ID_REQUIRED,
  responseTimeSeconds,
  selectEligibleStores,
  STORE_PLANS_FREE_MONTHLY,
  FREE_MONTHLY_REQUEST_LIMIT,
  PLUS_MONTHLY_REQUEST_LIMIT,
  MAX_CUSTOMER_RADIUS_MILES,
} from "../_shared/domain.ts";
import { sendExpoPush, deliverStorePush } from "../_shared/push.ts";

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
  const bypassConsumerLimits =
    Deno.env.get("FINDIT_BYPASS_PLAN_LIMITS") === "true";
  const bypassStoreCaps =
    bypassConsumerLimits || Deno.env.get("FINDIT_PILOT_MODE") === "true";

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Please sign in", needsAuth: true }, 401, origin);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return jsonResponse({ error: "Please sign in", needsAuth: true }, 401, origin);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, origin);
  }

  const productName = String(body.productName || "").trim();
  const city = String(body.city || "").trim();
  const state = String(body.state || "VA").trim().slice(0, 2).toUpperCase();
  const postalCode = String(body.postalCode || "").trim();
  const radiusMiles = Number(body.radiusMiles ?? 10);
  const expirationHours = Number(body.expirationHours ?? 24);
  const description = body.description ? String(body.description) : "";
  const categoryRaw = body.category ? String(body.category) : "";
  const forceDuplicate = Boolean(body.forceDuplicate);
  const imageUrl = body.imageUrl ? String(body.imageUrl) : null;
  const imageStoragePath = body.imageStoragePath
    ? String(body.imageStoragePath)
    : null;
  const latitude =
    body.latitude != null && body.latitude !== ""
      ? Number(body.latitude)
      : null;
  const longitude =
    body.longitude != null && body.longitude !== ""
      ? Number(body.longitude)
      : null;

  if (productName.length < 2 || productName.length > 120) {
    return jsonResponse({ error: "Enter a product name" }, 400, origin);
  }
  if (city.length < 2) {
    return jsonResponse({ error: "City is required" }, 400, origin);
  }
  if (!/^\d{5}(-\d{4})?$/.test(postalCode)) {
    return jsonResponse({ error: "Enter a valid ZIP code" }, 400, origin);
  }
  if (![4, 12, 24, 48].includes(expirationHours)) {
    return jsonResponse({ error: "Invalid expiration" }, 400, origin);
  }
  if (categoryRaw && !(PRODUCT_CATEGORIES as readonly string[]).includes(categoryRaw)) {
    return jsonResponse({ error: "Invalid category" }, 400, origin);
  }
  if (
    isAgeRestrictedFind({
      category: categoryRaw,
      productName,
      description,
    }) &&
    !Boolean(body.ageRestrictedConfirmed)
  ) {
    return jsonResponse(
      { error: AGE_RESTRICTED_ID_REQUIRED, code: "age_restricted" },
      400,
      origin
    );
  }
  if (imageUrl && imageUrl.startsWith("data:")) {
    return jsonResponse(
      { error: "Please upload the photo again (image storage required)." },
      400,
      origin
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, account_type, subscription_plan, is_suspended")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_suspended) {
    return jsonResponse({ error: "Account unavailable" }, 403, origin);
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await admin
    .from("customer_requests")
    .select("*", { count: "exact", head: true })
    .eq("customer_id", user.id)
    .gte("created_at", hourAgo)
    .in("status", ["active", "partially_answered", "answered", "draft"]);
  if ((recentCount || 0) >= 10) {
    return jsonResponse(
      { error: "You can create up to 10 requests per hour." },
      429,
      origin
    );
  }

  const normalized = normalizeProductName(productName);
  if (!forceDuplicate) {
    const { data: existingActive } = await admin
      .from("customer_requests")
      .select("id, normalized_product_name, category, status, created_at")
      .eq("customer_id", user.id)
      .in("status", ["active", "partially_answered", "answered"])
      .order("created_at", { ascending: false })
      .limit(20);
    const windowMs = 15 * 60 * 1000;
    const dup = (existingActive || []).find(
      (r) =>
        r.normalized_product_name === normalized &&
        ((!r.category && !categoryRaw) ||
          (r.category || "").toLowerCase() === categoryRaw.toLowerCase()) &&
        Date.now() - new Date(r.created_at).getTime() <= windowMs
    );
    if (dup) {
      return jsonResponse(
        {
          error: "You already have an active request for this.",
          duplicateOf: dup.id,
        },
        409,
        origin
      );
    }
  }

  if (!bypassConsumerLimits) {
    const isPlus = profile.subscription_plan === "plus";
    const monthlyLimit = isPlus ? PLUS_MONTHLY_REQUEST_LIMIT : FREE_MONTHLY_REQUEST_LIMIT;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    // Count every created Find this month, including cancelled ones.
    const { count } = await admin
      .from("customer_requests")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", user.id)
      .gte("created_at", monthStart.toISOString());
    if ((count || 0) >= monthlyLimit) {
      return jsonResponse(
        {
          error: isPlus
            ? `FINDIT+ includes ${monthlyLimit} Finds per month.`
            : `You've used your ${monthlyLimit} free Finds this month.`,
          code: "plan_limit",
          upgradeRequired: !isPlus,
        },
        429,
        origin
      );
    }
  }

  if (radiusMiles > MAX_CUSTOMER_RADIUS_MILES) {
    return jsonResponse(
      {
        error: `FINDIT searches up to ${MAX_CUSTOMER_RADIUS_MILES} miles.`,
        code: "radius_limit",
      },
      400,
      origin
    );
  }

  const expiresAt = new Date(
    Date.now() + expirationHours * 60 * 60 * 1000
  ).toISOString();

  let requestLat = latitude != null && Number.isFinite(latitude) ? latitude : null;
  let requestLng =
    longitude != null && Number.isFinite(longitude) ? longitude : null;
  if (requestLat == null || requestLng == null) {
    try {
      const zipRes = await fetch(
        `https://api.zippopotam.us/us/${postalCode.slice(0, 5)}`
      );
      if (zipRes.ok) {
        const zipJson = await zipRes.json();
        const place = zipJson?.places?.[0];
        const lat = Number(place?.latitude);
        const lng = Number(place?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          requestLat = lat;
          requestLng = lng;
        }
      }
    } catch {
      // Keep ZIP-only routing if the centroid lookup fails.
    }
  }

  const { data: request, error } = await admin
    .from("customer_requests")
    .insert({
      customer_id: user.id,
      product_name: productName,
      normalized_product_name: normalized,
      description: description || null,
      category: categoryRaw || null,
      city,
      state,
      postal_code: postalCode,
      radius_miles: radiusMiles,
      status: "active",
      expires_at: expiresAt,
      image_url: imageUrl,
      image_storage_path: imageStoragePath,
      latitude: requestLat,
      longitude: requestLng,
    })
    .select("*")
    .single();

  if (error || !request) {
    const capHit = /Finds this month/i.test(error?.message || "");
    if (capHit) {
      const isPlus = profile.subscription_plan === "plus";
      const monthlyLimit = isPlus
        ? PLUS_MONTHLY_REQUEST_LIMIT
        : FREE_MONTHLY_REQUEST_LIMIT;
      return jsonResponse(
        {
          error: isPlus
            ? `FINDIT+ includes ${monthlyLimit} Finds per month.`
            : `You've used your ${monthlyLimit} free Finds this month.`,
          code: "plan_limit",
          upgradeRequired: !isPlus,
        },
        429,
        origin
      );
    }
    return jsonResponse(
      { error: "Couldn't create your request. Please try again." },
      500,
      origin
    );
  }

  await admin.from("analytics_events").insert({
    event_name: "request_created",
    user_id: user.id,
    request_id: request.id,
    metadata: {},
  });

  // Route
  const { data: stores } = await admin
    .from("stores")
    .select(
      "id, is_active, is_suspended, is_verified, postal_code, city, service_radius_miles, subscription_plan, business_type, accepting_requests, latitude, longitude"
    )
    .eq("is_active", true)
    .eq("is_suspended", false);

  let storesTargeted = 0;
  if (stores?.length) {
    const storeIds = stores.map((s) => s.id);
    const [
      { data: cats },
      { data: areas },
      { data: hours },
      { data: existingTargets },
      { data: catalogCats },
      { data: catalogKeys },
      { data: customKeys },
    ] = await Promise.all([
      admin
        .from("store_categories")
        .select("store_id, category")
        .in("store_id", storeIds),
      admin
        .from("store_service_areas")
        .select("store_id, postal_code")
        .in("store_id", storeIds),
      admin
        .from("store_hours")
        .select("store_id, day_of_week, open_time, close_time, is_closed")
        .in("store_id", storeIds),
      admin
        .from("request_targets")
        .select("store_id")
        .eq("request_id", request.id),
      admin
        .from("store_catalog_categories")
        .select("store_id, category_id")
        .in("store_id", storeIds),
      admin
        .from("store_catalog_keywords")
        .select("store_id, keyword_id")
        .in("store_id", storeIds),
      admin
        .from("store_custom_keywords")
        .select("store_id, normalized_keyword")
        .in("store_id", storeIds),
    ]);

    const keywordIds = [
      ...new Set((catalogKeys || []).map((row) => row.keyword_id).filter(Boolean)),
    ];
    const { data: keywordRows } = keywordIds.length
      ? await admin
          .from("catalog_keywords")
          .select("id, normalized_keyword")
          .in("id", keywordIds)
      : { data: [] as { id: string; normalized_keyword: string }[] };
    const keywordTextById = new Map(
      (keywordRows || []).map((row) => [row.id, row.normalized_keyword])
    );

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { data: monthTargets } = await admin
      .from("request_targets")
      .select("store_id")
      .in("store_id", storeIds)
      .gte("created_at", monthStart.toISOString());

    const monthCounts = new Map<string, number>();
    for (const t of monthTargets || []) {
      monthCounts.set(t.store_id, (monthCounts.get(t.store_id) || 0) + 1);
    }

    const candidates = stores.map((store) => ({
      id: store.id,
      is_active: store.is_active,
      is_suspended: store.is_suspended,
      is_verified: store.is_verified,
      postal_code: store.postal_code,
      city: store.city,
      service_radius_miles: store.service_radius_miles ?? 10,
      subscription_plan: store.subscription_plan,
      businessTypeId: store.business_type || null,
      acceptingRequests: store.accepting_requests !== false,
      latitude: store.latitude,
      longitude: store.longitude,
      categories: (cats || [])
        .filter((c) => c.store_id === store.id)
        .map((c) => c.category),
      catalogCategoryIds: (catalogCats || [])
        .filter((c) => c.store_id === store.id)
        .map((c) => c.category_id),
      catalogKeywordIds: (catalogKeys || [])
        .filter((c) => c.store_id === store.id)
        .map((c) => c.keyword_id),
      catalogKeywordTexts: (catalogKeys || [])
        .filter((c) => c.store_id === store.id)
        .map((c) => keywordTextById.get(c.keyword_id) || "")
        .filter(Boolean),
      customKeywords: (customKeys || [])
        .filter((c) => c.store_id === store.id)
        .map((c) => c.normalized_keyword),
      service_zips: (areas || [])
        .filter((a) => a.store_id === store.id)
        .map((a) => a.postal_code),
      month_targets_received: monthCounts.get(store.id) || 0,
      free_plan_monthly_cap: STORE_PLANS_FREE_MONTHLY,
    }));

    const { eligible } = selectEligibleStores({
      request: {
        id: request.id,
        postal_code: request.postal_code,
        city: request.city,
        category: request.category,
        radius_miles: request.radius_miles,
        productName: request.product_name,
        description: request.description,
        categoryConfirmed: Boolean(request.category_confirmed || request.category),
        latitude: request.latitude,
        longitude: request.longitude,
      },
      stores: candidates,
      alreadyTargetedStoreIds: (existingTargets || []).map((t) => t.store_id),
      bypassPlanCaps: bypassStoreCaps,
    });

    const nowIso = new Date().toISOString();
    const rows = eligible.map((d) => {
      const storeHours = (hours || []).filter((h) => h.store_id === d.storeId);
      const openInfo = isStoreOpenAt(storeHours);
      return {
        request_id: request.id,
        store_id: d.storeId,
        delivery_status: "sent",
        route_sent_at: nowIso,
        was_closed_at_route: !openInfo.open,
        routing_reason: d.routingReason || null,
        match_kind: d.matchKind || null,
        notify_after:
          !openInfo.open && openInfo.reopenAt
            ? openInfo.reopenAt.toISOString()
            : null,
      };
    });

    if (rows.length) {
      await admin
        .from("request_targets")
        .upsert(rows, { onConflict: "request_id,store_id" });

      const notifyStoreIds = rows
        .filter(
          (r) => !r.notify_after || new Date(r.notify_after).getTime() <= Date.now()
        )
        .map((r) => r.store_id);

      if (notifyStoreIds.length) {
        const { data: members } = await admin
          .from("store_members")
          .select("user_id, store_id")
          .in("store_id", notifyStoreIds)
          .eq("status", "active");

        const notifications = (members || [])
          .filter((m) => m.user_id)
          .map((m) => ({
            user_id: m.user_id!,
            type: "new_request",
            title: "New product request",
            body: `New request nearby: ${request.product_name}`,
            related_request_id: request.id,
            related_store_id: m.store_id,
          }));
        if (notifications.length) {
          await admin.from("notifications").insert(notifications);
        }

        const pushTask = fanoutEmployeePush(admin, members || [], {
          title: "New FINDIT request",
          body: request.product_name,
          data: {
            type: "new_request",
            requestId: request.id,
            url: `/store/requests/${request.id}`,
          },
        }).catch((err) => {
          console.error("[FINDIT] Store push failed", err);
        });
        const runtime = (
          globalThis as {
            EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
          }
        ).EdgeRuntime;
        if (runtime?.waitUntil) runtime.waitUntil(pushTask);
      }
    }

    const { count } = await admin
      .from("request_targets")
      .select("*", { count: "exact", head: true })
      .eq("request_id", request.id);
    storesTargeted = count || rows.length;

    await admin
      .from("customer_requests")
      .update({ stores_targeted: storesTargeted })
      .eq("id", request.id);

    await admin.from("analytics_events").insert({
      event_name: "request_routed",
      request_id: request.id,
      metadata: { stores: storesTargeted },
    });
  }

  // silence unused imports in this file path
  void deriveRequestStatus;
  void responseTimeSeconds;

  return jsonResponse(
    {
      request: { ...request, stores_targeted: storesTargeted },
      storesTargeted,
      noStores: storesTargeted === 0,
    },
    200,
    origin
  );
});

async function fanoutEmployeePush(
  admin: ReturnType<typeof createClient>,
  members: { user_id: string | null; store_id: string }[],
  payload: { title: string; body: string; data: Record<string, string> }
) {
  const userIds = [
    ...new Set(members.map((m) => m.user_id).filter(Boolean) as string[]),
  ];
  if (!userIds.length) return;
  const delivered = await deliverStorePush({
    userIds,
    title: payload.title,
    body: payload.body,
    data: payload.data,
  });
  if (delivered) return;

  const { data: tokens } = await admin
    .from("device_push_tokens")
    .select("token, platform, user_id")
    .in("user_id", userIds)
    .in("app_surface", ["employee", "web"]);
  if (!tokens?.length) return;

  await sendExpoPush(
    tokens
      .filter(
        (t) =>
          t.token.startsWith("ExponentPushToken[") ||
          t.token.startsWith("ExpoPushToken[")
      )
      .map((t) => ({
        to: t.token,
        sound: "default",
        title: payload.title,
        body: payload.body,
        data: payload.data,
      }))
  );
}
