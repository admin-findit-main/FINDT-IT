import { describe, expect, it } from "vitest";
import {
  estimateRoutingDistanceMiles,
  estimateZipDistanceMiles,
  formatEstimatedDistanceMiles,
  haversineMiles,
  selectEligibleStores,
  sortCustomerResponsesByDistance,
} from "../routing";

describe("formatEstimatedDistanceMiles", () => {
  it("labels same ZIP, nearby, and unknown", () => {
    expect(formatEstimatedDistanceMiles(0)).toBe("Same ZIP");
    expect(formatEstimatedDistanceMiles(8)).toBe("About 8 mi");
    expect(formatEstimatedDistanceMiles(99)).toBe("Farther away");
  });
});

describe("nearby ZIP radius", () => {
  it("treats 20001 and 20002 as about 2 miles, not out of area", () => {
    expect(estimateZipDistanceMiles("20001", "20002")).toBe(2);
    expect(estimateZipDistanceMiles("20002", "20001")).toBe(2);
  });

  it("routes a 20001 store to a 20002 customer within a 5-mile radius", () => {
    const { eligible, excluded } = selectEligibleStores({
      request: {
        id: "r-dc",
        postal_code: "20002",
        city: "Washington",
        category: null,
        radius_miles: 5,
      },
      stores: [
        {
          id: "store-20001",
          is_active: true,
          is_suspended: false,
          postal_code: "20001",
          city: "Washington",
          service_radius_miles: 5,
          categories: [],
          service_zips: ["20001"],
        },
      ],
    });
    expect(eligible.map((e) => e.storeId)).toEqual(["store-20001"]);
    expect(eligible[0]?.estimatedMiles).toBe(2);
    expect(excluded).toEqual([]);
  });

  it("uses GPS miles when both sides have coordinates", () => {
    // 20001 vs 20002 centroids are ~2 miles apart.
    const miles = haversineMiles(38.9102, -77.017, 38.9052, -76.981);
    expect(miles).toBeGreaterThan(1);
    expect(miles).toBeLessThan(4);

    const { eligible } = selectEligibleStores({
      request: {
        id: "r-gps",
        postal_code: "20002",
        city: "Washington",
        category: null,
        radius_miles: 5,
        latitude: 38.9052,
        longitude: -76.981,
      },
      stores: [
        {
          id: "store-gps",
          is_active: true,
          is_suspended: false,
          postal_code: "20001",
          city: "Washington",
          service_radius_miles: 10,
          categories: [],
          service_zips: ["20001"],
          latitude: 38.9102,
          longitude: -77.017,
        },
      ],
    });
    expect(eligible).toHaveLength(1);
    expect(eligible[0]?.estimatedMiles).toBe(
      estimateRoutingDistanceMiles({
        customerZip: "20002",
        storeZip: "20001",
        customerLatitude: 38.9052,
        customerLongitude: -76.981,
        storeLatitude: 38.9102,
        storeLongitude: -77.017,
      })
    );
  });

  it("still excludes far ZIPs outside the search radius", () => {
    const { eligible, excluded } = selectEligibleStores({
      request: {
        id: "r-far",
        postal_code: "20002",
        city: "Washington",
        category: null,
        radius_miles: 5,
      },
      stores: [
        {
          id: "la",
          is_active: true,
          is_suspended: false,
          postal_code: "90210",
          city: "Beverly Hills",
          service_radius_miles: 25,
          categories: [],
          service_zips: ["90210"],
        },
      ],
    });
    expect(eligible).toEqual([]);
    expect(excluded.some((e) => e.reason === "service_area")).toBe(true);
  });

  it("honors a 40-mile request even when the store listed a smaller radius", () => {
    const { eligible, excluded } = selectEligibleStores({
      request: {
        id: "r-40",
        postal_code: "20002",
        city: "Washington",
        category: null,
        radius_miles: 40,
        latitude: 38.9072,
        longitude: -77.0369,
      },
      stores: [
        {
          id: "baltimore",
          is_active: true,
          is_suspended: false,
          postal_code: "21201",
          city: "Baltimore",
          service_radius_miles: 5,
          categories: [],
          service_zips: ["21201"],
          latitude: 39.2904,
          longitude: -76.6122,
        },
      ],
    });
    expect(eligible.map((e) => e.storeId)).toEqual(["baltimore"]);
    expect(eligible[0]?.estimatedMiles).toBeGreaterThan(20);
    expect(eligible[0]?.estimatedMiles).toBeLessThan(40);
    expect(excluded).toEqual([]);
  });

  it("still respects a tighter search the shopper asked for", () => {
    const { eligible, excluded } = selectEligibleStores({
      request: {
        id: "r-10",
        postal_code: "20002",
        city: "Washington",
        category: null,
        radius_miles: 10,
        latitude: 38.9072,
        longitude: -77.0369,
      },
      stores: [
        {
          id: "baltimore",
          is_active: true,
          is_suspended: false,
          postal_code: "21201",
          city: "Baltimore",
          service_radius_miles: 40,
          categories: [],
          service_zips: ["21201"],
          latitude: 39.2904,
          longitude: -76.6122,
        },
      ],
    });
    expect(eligible).toEqual([]);
    expect(excluded.some((e) => e.reason === "radius")).toBe(true);
  });
});

describe("sortCustomerResponsesByDistance", () => {
  it("orders closest first, then by availability", () => {
    const sorted = sortCustomerResponsesByDistance(
      [
        {
          id: "far-stock",
          response_type: "in_stock",
          store: { postal_code: "90210", city: "Beverly Hills" },
        },
        {
          id: "near-order",
          response_type: "can_order",
          store: { postal_code: "22046", city: "Falls Church" },
        },
        {
          id: "same-oos",
          response_type: "out_of_stock",
          store: { postal_code: "22044", city: "Falls Church" },
        },
        {
          id: "same-stock",
          response_type: "in_stock",
          store: { postal_code: "22044", city: "Falls Church" },
        },
      ],
      "22044",
      "Falls Church"
    );
    expect(sorted.map((r) => r.id)).toEqual([
      "same-stock",
      "same-oos",
      "near-order",
      "far-stock",
    ]);
  });
});
