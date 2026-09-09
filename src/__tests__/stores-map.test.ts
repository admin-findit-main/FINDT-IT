import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_STORE_MAP_KEYS,
  publicStoreMapKeys,
  type PublicStoreMapItem,
} from "@/lib/services/stores-map";
import { haversineMiles } from "@findit/domain";

function sampleStore(
  overrides: Partial<PublicStoreMapItem> = {}
): PublicStoreMapItem {
  return {
    id: "a",
    name: "Alpha",
    slug: "alpha",
    street_address: "1 Main St",
    city: "Falls Church",
    state: "VA",
    postal_code: "22046",
    phone: "703-555-0100",
    website: null,
    is_verified: true,
    accepting_requests: true,
    avg_response_minutes: 12,
    latitude: 38.8856,
    longitude: -77.1802,
    business_type: "smoke_shop",
    open_now: true,
    open_label: "Open",
    hours_label: "Mon: 09:00–21:00",
    distance_miles: null,
    hours: [],
    ...overrides,
  };
}

describe("public stores map DTO", () => {
  it("never includes private store columns", () => {
    const keys = publicStoreMapKeys(sampleStore());
    for (const forbidden of FORBIDDEN_STORE_MAP_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
    expect(keys).toContain("slug");
    expect(keys).toContain("latitude");
    expect(keys).toContain("open_now");
  });

  it("sorts nearest-first when distances are attached", () => {
    const origin = { lat: 38.8856, lng: -77.1802 };
    const near = sampleStore({
      id: "near",
      name: "Near",
      latitude: 38.886,
      longitude: -77.181,
    });
    const far = sampleStore({
      id: "far",
      name: "Far",
      latitude: 38.8073,
      longitude: -77.0835,
    });
    const withDistance = [far, near].map((store) => ({
      ...store,
      distance_miles:
        Math.round(
          haversineMiles(
            origin.lat,
            origin.lng,
            store.latitude,
            store.longitude
          ) * 10
        ) / 10,
    }));
    withDistance.sort((a, b) => {
      const da = a.distance_miles ?? Number.POSITIVE_INFINITY;
      const db = b.distance_miles ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name);
    });
    expect(withDistance.map((s) => s.id)).toEqual(["near", "far"]);
    expect(withDistance[0].distance_miles!).toBeLessThan(
      withDistance[1].distance_miles!
    );
  });
});
