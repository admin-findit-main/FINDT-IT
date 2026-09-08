import {
  routableCategoryCounts,
  type RoutableCategoryCount,
} from "@findit/domain";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServiceClient } from "@/lib/supabase/admin";

const CACHE_TTL_MS = 60_000;
let cached:
  | { expiresAt: number; categories: RoutableCategoryCount[] }
  | undefined;

/**
 * Aggregate-only lookup for customer category pickers. No store row,
 * identifier, location, or customer field leaves this service.
 */
export async function getRoutableCategoryCounts(): Promise<
  RoutableCategoryCount[]
> {
  if (cached && cached.expiresAt > Date.now()) return cached.categories;
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("stores")
    .select("is_active, is_suspended, accepting_requests, business_type")
    .eq("is_active", true)
    .eq("is_suspended", false)
    .eq("accepting_requests", true);
  if (error || !data) return [];

  const categories = routableCategoryCounts(data);
  cached = { categories, expiresAt: Date.now() + CACHE_TTL_MS };
  return categories;
}
