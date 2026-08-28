import { STORE_TRIAL_DAYS } from "@/lib/config/constants";
import { isDemoMode } from "@/lib/config/env";
import {
  categoriesOverlap,
  storeCategoriesForRequestCategory,
} from "@/lib/services/category-routing";
import { slugify } from "@/lib/utils";
import { defaultCategoryIdsForType } from "@findit/domain";
import { coordsFromZip } from "@/lib/services/zip-centroids";
import type { DemandItem, Store, StoreMetrics } from "@/types/database";

export async function provisionStoreFromApplication(applicationId: string, reviewerId: string) {
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();

  const { data: application, error: loadError } = await admin
    .from("store_applications")
    .select("*")
    .eq("id", applicationId)
    .single();
  if (loadError || !application) throw new Error(loadError?.message || "Application not found");
  if (application.status !== "pending" && application.status !== "needs_info") {
    throw new Error("Application already reviewed");
  }

  let ownerId = application.applicant_user_id as string | null;

  if (!ownerId) {
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", application.owner_email.toLowerCase())
      .maybeSingle();
    ownerId = existing?.id || null;
  }

  if (!ownerId) {
    const { data: created, error: createUserError } = await admin.auth.admin.createUser({
      email: application.owner_email.toLowerCase(),
      email_confirm: true,
      user_metadata: {
        first_name: String(application.owner_name).split(" ")[0] || application.owner_name,
        last_name: String(application.owner_name).split(" ").slice(1).join(" ") || "",
        display_name: application.owner_name,
        account_type: "business",
        default_city: application.city,
        default_state: application.state,
        default_postal_code: application.postal_code,
      },
    });
    if (createUserError || !created.user) {
      throw new Error(
        createUserError?.message ||
          "Owner needs an account. Ask them to sign up with the application email, then approve again."
      );
    }
    ownerId = created.user.id;
  }

  await admin
    .from("profiles")
    .update({
      account_type: "business",
      default_city: application.city,
      default_state: application.state,
      default_postal_code: application.postal_code,
    })
    .eq("id", ownerId);

  let slug = slugify(application.business_name);
  const { data: slugHit } = await admin.from("stores").select("id").eq("slug", slug).maybeSingle();
  if (slugHit) slug = `${slug}-${Date.now().toString(36)}`;

  const trialEnds = new Date(Date.now() + STORE_TRIAL_DAYS * 86400000).toISOString();
  const requestCategories: string[] =
    Array.isArray(application.request_categories) && application.request_categories.length
      ? application.request_categories
      : [application.business_type];

  const zipPoint = await coordsFromZip(application.postal_code);

  const { data: store, error: storeError } = await admin
    .from("stores")
    .insert({
      owner_id: ownerId,
      name: application.business_name,
      slug,
      legal_name: application.legal_name || application.business_name,
      ein: application.ein || null,
      entity_type: application.entity_type || null,
      street_address: application.street_address,
      city: application.city,
      state: application.state,
      postal_code: application.postal_code,
      phone: application.phone,
      website: application.website,
      is_active: true,
      is_verified: true,
      is_suspended: false,
      subscription_plan: "free",
      subscription_status: "active",
      trial_ends_at: trialEnds,
      service_radius_miles: 10,
      age_restricted: Boolean(application.requires_customer_id),
      accepting_requests: true,
      latitude: zipPoint?.latitude ?? null,
      longitude: zipPoint?.longitude ?? null,
      business_type:
        application.business_type === "Smoke Shop"
          ? "smoke_shop"
          : application.business_type === "Coffee Shop"
            ? "coffee_shop"
            : application.business_type === "Auto Parts"
              ? "auto_parts"
              : application.business_type === "Nail Salon"
                ? "nail_salon"
                : application.business_type === "Grocery"
                  ? "grocery"
                  : application.business_type === "Convenience"
                    ? "convenience"
                    : "other",
    })
    .select("*")
    .single();
  if (storeError || !store) throw new Error(storeError?.message || "Failed to create store");

  await admin.from("store_members").insert({
    store_id: store.id,
    user_id: ownerId,
    role: "owner",
    status: "active",
  });

  const categoryRows = [...new Set([application.business_type, ...requestCategories])].map(
    (category) => ({ store_id: store.id, category })
  );
  await admin.from("store_categories").insert(categoryRows);

  const catalogIds = defaultCategoryIdsForType(store.business_type || "");
  if (catalogIds.length) {
    await admin.from("store_catalog_categories").insert(
      catalogIds.map((category_id) => ({ store_id: store.id, category_id }))
    );
  }

  await admin.from("store_service_areas").insert({
    store_id: store.id,
    postal_code: application.postal_code,
    city: application.city,
    state: application.state,
  });

  const hours = Array.from({ length: 7 }, (_, day) => ({
    store_id: store.id,
    day_of_week: day,
    open_time: day === 0 ? null : "09:00",
    close_time: day === 0 ? null : "21:00",
    is_closed: day === 0,
  }));
  await admin.from("store_hours").insert(hours);

  await admin.from("subscriptions").upsert(
    {
      store_id: store.id,
      plan: "free",
      status: "active",
      current_period_end: trialEnds,
    },
    { onConflict: "store_id" }
  );

  const { data: updatedApp, error: updateError } = await admin
    .from("store_applications")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
      created_store_id: store.id,
      applicant_user_id: ownerId,
    })
    .eq("id", applicationId)
    .select("*")
    .single();
  if (updateError) throw new Error(updateError.message);

  await admin.from("notifications").insert({
    user_id: ownerId,
    type: "store_approved",
    title: "Your store was approved",
    body: `${store.name} is live on FINDIT with a ${STORE_TRIAL_DAYS}-day free pilot. Open your dashboard and connect FINDIT Hub. No credit card required.`,
    related_store_id: store.id,
  });

  return { application: updatedApp, store: store as Store };
}

export async function computeStoreDemandFromSupabase(storeId: string): Promise<DemandItem[]> {
  if (isDemoMode()) {
    const { demoGetStoreDemand } = await import("@/lib/demo/store");
    return demoGetStoreDemand(storeId);
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: targets } = await supabase
    .from("request_targets")
    .select("request_id, created_at")
    .eq("store_id", storeId)
    .gte("created_at", monthStart.toISOString());

  const requestIds = [...new Set((targets || []).map((t) => t.request_id))];
  if (!requestIds.length) return [];

  const { data: requests } = await supabase
    .from("customer_requests")
    .select("id, product_name, normalized_product_name")
    .in("id", requestIds);

  const { data: storeResponses } = await supabase
    .from("store_responses")
    .select("request_id, response_type")
    .eq("store_id", storeId)
    .in("request_id", requestIds);

  const map = new Map<string, DemandItem>();
  for (const req of requests || []) {
    const key = req.normalized_product_name;
    const item =
      map.get(key) ||
      ({
        product_name: req.product_name,
        normalized_product_name: key,
        request_count: 0,
        out_of_stock_count: 0,
        in_stock_count: 0,
        can_order_count: 0,
        unanswered_count: 0,
        out_of_stock_rate: 0,
        opportunity_score: 0,
        insight: null,
        consider_stocking: false,
      } satisfies DemandItem);
    item.request_count += 1;
    const response = (storeResponses || []).find((r) => r.request_id === req.id);
    if (!response) item.unanswered_count += 1;
    if (response?.response_type === "out_of_stock") item.out_of_stock_count += 1;
    if (response?.response_type === "in_stock") item.in_stock_count += 1;
    if (response?.response_type === "can_order") item.can_order_count += 1;
    map.set(key, item);
  }

  return [...map.values()]
    .map((item) => {
      const answered =
        item.in_stock_count + item.out_of_stock_count + item.can_order_count || 1;
      item.out_of_stock_rate = item.out_of_stock_count / answered;
      item.opportunity_score = Math.round(
        item.request_count * item.out_of_stock_rate + item.unanswered_count * 0.5
      );
      item.consider_stocking =
        item.request_count >= 5 &&
        (item.out_of_stock_count + item.unanswered_count) / item.request_count >= 0.4;
      item.insight = item.consider_stocking
        ? `${item.request_count} people searched for ${item.product_name} nearby. Consider stocking this product.`
        : item.unanswered_count > 0
          ? `${item.unanswered_count} request${item.unanswered_count === 1 ? " was" : "s were"} unanswered.`
          : `${item.request_count} search${item.request_count === 1 ? "" : "es"} this period.`;
      return item;
    })
    .sort((a, b) => b.request_count - a.request_count);
}

export async function computeStoreMetricsFromSupabase(storeId: string): Promise<StoreMetrics> {
  if (isDemoMode()) {
    const { demoGetStoreMetrics } = await import("@/lib/demo/store");
    return demoGetStoreMetrics(storeId);
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const week = new Date();
  week.setDate(week.getDate() - 7);
  const month = new Date();
  month.setDate(1);
  month.setHours(0, 0, 0, 0);

  const yStart = new Date(start);
  yStart.setDate(yStart.getDate() - 1);

  const { data: yesterdayTargets } = await supabase
    .from("request_targets")
    .select("request_id")
    .eq("store_id", storeId)
    .gte("created_at", yStart.toISOString())
    .lt("created_at", start.toISOString());
  const yesterdayIds = (yesterdayTargets || []).map((t) => t.request_id);
  const { data: yesterdayResponses } = yesterdayIds.length
    ? await supabase
        .from("store_responses")
        .select("request_id")
        .eq("store_id", storeId)
        .in("request_id", yesterdayIds)
    : { data: [] as { request_id: string }[] };

  const { data: todayTargets } = await supabase
    .from("request_targets")
    .select("request_id, created_at")
    .eq("store_id", storeId)
    .gte("created_at", start.toISOString());

  const todayIds = (todayTargets || []).map((t) => t.request_id);
  const { data: todayResponses } = todayIds.length
    ? await supabase
        .from("store_responses")
        .select("request_id, response_type")
        .eq("store_id", storeId)
        .in("request_id", todayIds)
    : { data: [] as { request_id: string; response_type: string }[] };

  const { count: totalReceived } = await supabase
    .from("request_targets")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId);

  const { data: allResponses } = await supabase
    .from("store_responses")
    .select("response_type, created_at, request_id")
    .eq("store_id", storeId);

  const answered = (allResponses || []).length;
  const total = totalReceived || 1;
  const inStock = (allResponses || []).filter((r) => r.response_type === "in_stock").length;
  const out = (allResponses || []).filter((r) => r.response_type === "out_of_stock").length;
  const canOrder = (allResponses || []).filter((r) => r.response_type === "can_order").length;

  const { data: weekTargets } = await supabase
    .from("request_targets")
    .select("request_id, response_time_seconds, created_at")
    .eq("store_id", storeId)
    .gte("created_at", week.toISOString());
  const weekIds = (weekTargets || []).map((t) => t.request_id);
  const { data: weekResponses } = weekIds.length
    ? await supabase
        .from("store_responses")
        .select("request_id, response_type")
        .eq("store_id", storeId)
        .in("request_id", weekIds)
    : { data: [] as { request_id: string; response_type: string }[] };

  const { count: weekFinds } = await supabase
    .from("customer_requests")
    .select("*", { count: "exact", head: true })
    .eq("fulfilled_store_id", storeId)
    .gte("fulfilled_at", week.toISOString());

  const weekTimes = (weekTargets || [])
    .filter((t) => t.response_time_seconds != null)
    .map((t) => t.response_time_seconds as number);
  const avgWeekSec =
    weekTimes.length > 0
      ? Math.round(weekTimes.reduce((a, b) => a + b, 0) / weekTimes.length)
      : null;

  const { data: store } = await supabase
    .from("stores")
    .select("avg_response_minutes")
    .eq("id", storeId)
    .single();

  return {
    requests_today: todayTargets?.length || 0,
    answered_today: todayResponses?.length || 0,
    requests_yesterday: yesterdayTargets?.length || 0,
    answered_yesterday: yesterdayResponses?.length || 0,
    waiting_today: (todayTargets?.length || 0) - (todayResponses?.length || 0),
    in_stock_today: (todayResponses || []).filter((r) => r.response_type === "in_stock").length,
    total_received: totalReceived || 0,
    total_answered: answered,
    avg_response_minutes: store?.avg_response_minutes ?? null,
    in_stock_pct: Math.round((inStock / total) * 100),
    out_of_stock_pct: Math.round((out / total) * 100),
    can_order_pct: Math.round((canOrder / total) * 100),
    unanswered_pct: Math.round((((totalReceived || 0) - answered) / total) * 100),
    week_received: weekTargets?.length || 0,
    week_answered: weekResponses?.length || 0,
    week_response_rate: Math.round(
      ((weekResponses?.length || 0) / Math.max(weekTargets?.length || 1, 1)) * 100
    ),
    week_avg_response_minutes:
      avgWeekSec != null ? Math.max(1, Math.round(avgWeekSec / 60)) : null,
    week_in_stock: (weekResponses || []).filter((r) => r.response_type === "in_stock").length,
    week_customer_finds: weekFinds || 0,
  };
}

export function filterEligibleStoresByCategory<T extends { id: string }>(
  stores: T[],
  storeCategories: { store_id: string; category: string }[],
  requestCategory: string | null | undefined
): T[] {
  const allowed = storeCategoriesForRequestCategory(requestCategory);
  if (!allowed) return stores;
  return stores.filter((s) => {
    const cats = storeCategories
      .filter((c) => c.store_id === s.id)
      .map((c) => c.category);
    if (!cats.length) return true;
    return categoriesOverlap(cats, allowed);
  });
}
