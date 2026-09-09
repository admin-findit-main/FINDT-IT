import {
  formatHoursSummary,
  haversineMiles,
  isStoreOpenAt,
  parseGeoCoord,
  type StoreHourRow,
} from "@findit/domain";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServiceClient } from "@/lib/supabase/admin";

const MAX_STORES = 200;

const PUBLIC_STORE_COLUMNS =
  "id, name, slug, street_address, city, state, postal_code, phone, website, is_verified, accepting_requests, avg_response_minutes, latitude, longitude, business_type";

export type PublicStoreMapHour = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
};

/** Scrubbed public store row for the customer map. No owner/billing secrets. */
export type PublicStoreMapItem = {
  id: string;
  name: string;
  slug: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string | null;
  website: string | null;
  is_verified: boolean;
  accepting_requests: boolean;
  avg_response_minutes: number | null;
  latitude: number;
  longitude: number;
  business_type: string | null;
  open_now: boolean;
  open_label: string;
  hours_label: string;
  distance_miles: number | null;
  hours: PublicStoreMapHour[];
};

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  phone: string | null;
  website: string | null;
  is_verified: boolean | null;
  accepting_requests: boolean | null;
  avg_response_minutes: number | null;
  latitude: number | string | null;
  longitude: number | string | null;
  business_type: string | null;
};

type HourRow = StoreHourRow & { store_id: string };

function toPublicHours(hours: StoreHourRow[]): PublicStoreMapHour[] {
  return hours
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((h) => ({
      day_of_week: h.day_of_week,
      open_time: h.open_time,
      close_time: h.close_time,
      is_closed: h.is_closed,
    }));
}

function scrubStore(
  row: StoreRow,
  hours: StoreHourRow[],
  origin: { lat: number; lng: number } | null
): PublicStoreMapItem | null {
  const latitude = parseGeoCoord(row.latitude);
  const longitude = parseGeoCoord(row.longitude);
  if (latitude == null || longitude == null) return null;

  const openInfo = isStoreOpenAt(hours);
  const distanceMiles =
    origin != null
      ? Math.round(haversineMiles(origin.lat, origin.lng, latitude, longitude) * 10) /
        10
      : null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    street_address: (row.street_address || "").trim(),
    city: (row.city || "").trim(),
    state: (row.state || "").trim(),
    postal_code: (row.postal_code || "").trim(),
    phone: row.phone || null,
    website: row.website || null,
    is_verified: Boolean(row.is_verified),
    accepting_requests: Boolean(row.accepting_requests),
    avg_response_minutes: row.avg_response_minutes,
    latitude,
    longitude,
    business_type: row.business_type || null,
    open_now: openInfo.open,
    open_label: openInfo.open ? "Open" : "Closed",
    hours_label: formatHoursSummary(hours) || openInfo.label,
    distance_miles: distanceMiles,
    hours: toPublicHours(hours),
  };
}

/** Assert a value is a public DTO field set — used by tests. */
export function publicStoreMapKeys(store: PublicStoreMapItem): string[] {
  return Object.keys(store).sort();
}

export const FORBIDDEN_STORE_MAP_KEYS = [
  "owner_id",
  "ein",
  "legal_name",
  "stripe_customer_id",
  "stripe_subscription_id",
  "billing_email",
  "subscription_status",
] as const;

export async function getPublicStoresForMap(input?: {
  lat?: number | null;
  lng?: number | null;
}): Promise<PublicStoreMapItem[]> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const origin =
    input?.lat != null &&
    input?.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
      ? { lat: input.lat, lng: input.lng }
      : null;

  const admin = createServiceClient();
  const { data: stores, error } = await admin
    .from("stores")
    .select(PUBLIC_STORE_COLUMNS)
    .eq("is_active", true)
    .eq("is_suspended", false)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(MAX_STORES);

  if (error || !stores?.length) return [];

  const ids = stores.map((s) => s.id);
  const { data: hourRows } = await admin
    .from("store_hours")
    .select("store_id, day_of_week, open_time, close_time, is_closed")
    .in("store_id", ids);

  const hoursByStore = new Map<string, StoreHourRow[]>();
  for (const row of (hourRows || []) as HourRow[]) {
    const list = hoursByStore.get(row.store_id) || [];
    list.push({
      day_of_week: row.day_of_week,
      open_time: row.open_time,
      close_time: row.close_time,
      is_closed: row.is_closed,
    });
    hoursByStore.set(row.store_id, list);
  }

  const items = (stores as StoreRow[])
    .map((row) => scrubStore(row, hoursByStore.get(row.id) || [], origin))
    .filter((row): row is PublicStoreMapItem => Boolean(row));

  if (origin) {
    items.sort((a, b) => {
      const da = a.distance_miles ?? Number.POSITIVE_INFINITY;
      const db = b.distance_miles ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name);
    });
  } else {
    items.sort((a, b) => a.name.localeCompare(b.name));
  }

  return items;
}
