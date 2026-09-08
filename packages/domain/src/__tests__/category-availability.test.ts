import { describe, expect, it } from "vitest";
import { routableCategoryCounts } from "../category-availability";

describe("routableCategoryCounts", () => {
  it("returns only active accepting pilot categories with valid catalog types", () => {
    expect(
      routableCategoryCounts([
        {
          is_active: true,
          is_suspended: false,
          accepting_requests: true,
          business_type: "smoke_shop",
        },
        {
          is_active: true,
          is_suspended: false,
          accepting_requests: true,
          business_type: "smoke_shop",
        },
        {
          is_active: true,
          is_suspended: false,
          accepting_requests: true,
          business_type: "dispensary",
        },
        {
          is_active: true,
          is_suspended: false,
          accepting_requests: true,
          business_type: "grocery",
        },
        {
          is_active: false,
          is_suspended: false,
          accepting_requests: true,
          business_type: "dispensary",
        },
        {
          is_active: true,
          is_suspended: false,
          accepting_requests: true,
          business_type: "not_in_catalog",
        },
      ])
    ).toEqual([
      { label: "Tobacco & Vape", count: 2 },
      { label: "Dispensary", count: 1 },
    ]);
  });

  it("does not advertise an uncovered allowlisted category", () => {
    expect(
      routableCategoryCounts([
        {
          is_active: true,
          is_suspended: false,
          accepting_requests: true,
          business_type: "smoke_shop",
        },
      ])
    ).toEqual([{ label: "Tobacco & Vape", count: 1 }]);
  });
});
