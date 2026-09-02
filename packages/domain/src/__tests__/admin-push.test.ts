import { describe, expect, it } from "vitest";
import {
  defaultAdminPushUrl,
  isAdminPushAudience,
  parseAdminPushCopy,
  sanitizeAdminPushUrl,
} from "../admin-push";

describe("admin push copy", () => {
  it("keeps same-origin paths and drops off-site links", () => {
    expect(sanitizeAdminPushUrl("/store/requests", "/home")).toBe("/store/requests");
    expect(sanitizeAdminPushUrl("https://dashboard.askfindit.com/home", "/store")).toBe(
      "/home"
    );
    expect(sanitizeAdminPushUrl("https://evil.example/phish", "/home")).toBe("/home");
    expect(sanitizeAdminPushUrl("javascript:alert(1)", "/home")).toBe("/home");
    expect(sanitizeAdminPushUrl("//cdn.example/x", "/home")).toBe("/home");
    expect(defaultAdminPushUrl("employees")).toBe("/store");
    expect(defaultAdminPushUrl("shoppers")).toBe("/home");
  });

  it("requires a title and message", () => {
    expect(isAdminPushAudience("shoppers")).toBe(true);
    expect(isAdminPushAudience("bots")).toBe(false);
    expect(parseAdminPushCopy({ title: "", body: "Hi", audience: "all" })).toMatchObject({
      error: /title/i,
    });
    const ok = parseAdminPushCopy({
      title: "Hours",
      body: "Stores close at 8.",
      url: "",
      audience: "all",
    });
    expect(ok).toMatchObject({ title: "Hours", body: "Stores close at 8.", url: "/home" });
  });
});
