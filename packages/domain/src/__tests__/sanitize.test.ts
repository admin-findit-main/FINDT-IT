import { describe, expect, it } from "vitest";
import {
  sanitizeAppPath,
  sanitizePublicHttpsImageUrl,
} from "../sanitize";

describe("sanitizePublicHttpsImageUrl", () => {
  it("allows https raster images", () => {
    expect(
      sanitizePublicHttpsImageUrl("https://cdn.example.com/logo.png")
    ).toBe("https://cdn.example.com/logo.png");
    expect(
      sanitizePublicHttpsImageUrl("https://cdn.example.com/a.jpg?v=1")
    ).toBe("https://cdn.example.com/a.jpg?v=1");
  });

  it("rejects svg, data, http, and script urls", () => {
    expect(sanitizePublicHttpsImageUrl("https://x.com/a.svg")).toBeNull();
    expect(sanitizePublicHttpsImageUrl("data:image/png;base64,abc")).toBeNull();
    expect(sanitizePublicHttpsImageUrl("http://cdn.example.com/a.png")).toBeNull();
    expect(sanitizePublicHttpsImageUrl("javascript:alert(1)")).toBeNull();
    expect(
      sanitizePublicHttpsImageUrl("https://user:pass@cdn.example.com/a.png")
    ).toBeNull();
  });
});

describe("sanitizeAppPath", () => {
  it("keeps same-app paths and findit hosts", () => {
    expect(sanitizeAppPath("/notifications/abc")).toBe("/notifications/abc");
    expect(
      sanitizeAppPath("https://www.askfindit.com/notifications/x")
    ).toBe("/notifications/x");
  });

  it("falls back on open redirects", () => {
    expect(sanitizeAppPath("https://evil.example/phish")).toBe("/notifications");
    expect(sanitizeAppPath("javascript:alert(1)")).toBe("/notifications");
    expect(sanitizeAppPath("//cdn.example/x")).toBe("/notifications");
  });
});
