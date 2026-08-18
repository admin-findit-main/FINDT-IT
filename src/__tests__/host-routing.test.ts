import { describe, expect, it } from "vitest";
import {
  matchHostSurface,
  resolveHostPathRedirect,
} from "@/lib/config/hosts";

describe("optional host-based shells", () => {
  it("is a no-op when host env vars are unset", () => {
    expect(matchHostSurface("findit.example", {})).toBeNull();
    expect(resolveHostPathRedirect(null, "/")).toBeNull();
  });

  it("maps dedicated hosts to the matching shell", () => {
    const hosts = {
      business: "business.findit.local",
      hub: "hub.findit.local",
      admin: "admin.findit.local",
    };
    expect(matchHostSurface("business.findit.local:3002", hosts)).toBe(
      "business"
    );
    expect(matchHostSurface("hub.findit.local", hosts)).toBe("hub");
    expect(matchHostSurface("admin.findit.local", hosts)).toBe("admin");
    expect(resolveHostPathRedirect("business", "/")).toBe("/store");
    expect(resolveHostPathRedirect("hub", "/")).toBe("/store/hub");
    expect(resolveHostPathRedirect("admin", "/")).toBe("/admin");
    expect(resolveHostPathRedirect("business", "/login")).toBe(
      "/login/business"
    );
    expect(resolveHostPathRedirect("business", "/store/requests")).toBeNull();
  });
});
