import { describe, expect, it } from "vitest";
import { geolocationErrorMessage } from "@/lib/customer/geolocate";
import { isLikelyUsCoordinate } from "@/lib/services/reverse-geocode";

describe("geolocationErrorMessage", () => {
  it("tells you to allow location after a permission deny", () => {
    expect(geolocationErrorMessage({ code: 1 })).toMatch(/Allow location/);
  });

  it("asks you to type a city when GPS times out", () => {
    expect(geolocationErrorMessage({ code: 3 })).toMatch(/too long/);
  });

  it("still lets nearby ZIPs work when GPS is unavailable", () => {
    expect(geolocationErrorMessage({ code: 2 })).toMatch(/nearby ZIPs/);
  });
});

describe("reverse geocode coordinate validation", () => {
  it("accepts US bounds and rejects non-US or invalid points", () => {
    expect(isLikelyUsCoordinate(38.9, -77.0)).toBe(true);
    expect(isLikelyUsCoordinate(21.3, -157.8)).toBe(true);
    expect(isLikelyUsCoordinate(51.5, -0.1)).toBe(false);
    expect(isLikelyUsCoordinate(Number.NaN, -77)).toBe(false);
  });
});
