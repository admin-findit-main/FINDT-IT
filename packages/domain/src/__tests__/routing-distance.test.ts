import { describe, expect, it } from "vitest";
import {
  formatEstimatedDistanceMiles,
  sortCustomerResponsesByDistance,
} from "../routing";

describe("formatEstimatedDistanceMiles", () => {
  it("labels same ZIP, nearby, and unknown", () => {
    expect(formatEstimatedDistanceMiles(0)).toBe("Same ZIP");
    expect(formatEstimatedDistanceMiles(8)).toBe("About 8 mi");
    expect(formatEstimatedDistanceMiles(99)).toBe("Farther away");
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
