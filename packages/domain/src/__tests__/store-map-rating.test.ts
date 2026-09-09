import { describe, expect, it } from "vitest";
import { publicStoreMapRating } from "../store-map-rating";

describe("publicStoreMapRating", () => {
  it("returns new store label when no response time", () => {
    expect(
      publicStoreMapRating({ avg_response_minutes: null, is_verified: false })
    ).toEqual({
      score: null,
      stars: 0,
      label: "New on FINDIT",
    });
  });

  it("returns verified label with 4 stars when no response time but verified", () => {
    expect(
      publicStoreMapRating({ avg_response_minutes: null, is_verified: true })
    ).toEqual({
      score: null,
      stars: 4,
      label: "Verified FINDIT store",
    });
  });

  it("maps response minutes to stars", () => {
    expect(
      publicStoreMapRating({ avg_response_minutes: 8, is_verified: true }).stars
    ).toBe(5);
    expect(
      publicStoreMapRating({ avg_response_minutes: 15, is_verified: true }).stars
    ).toBe(4.5);
    expect(
      publicStoreMapRating({ avg_response_minutes: 30, is_verified: true }).stars
    ).toBe(4);
    expect(
      publicStoreMapRating({ avg_response_minutes: 45, is_verified: true }).stars
    ).toBe(3.5);
    expect(
      publicStoreMapRating({ avg_response_minutes: 90, is_verified: true }).stars
    ).toBe(3);
  });

  it("includes response time in label", () => {
    expect(
      publicStoreMapRating({ avg_response_minutes: 12, is_verified: false }).label
    ).toBe("Usually replies in about 12 min");
  });
});
