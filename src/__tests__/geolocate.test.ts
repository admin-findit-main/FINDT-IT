import { describe, expect, it } from "vitest";
import { geolocationErrorMessage } from "@/lib/customer/geolocate";

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
