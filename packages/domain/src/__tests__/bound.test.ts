import { describe, expect, it } from "vitest";
import { boundSlug, boundUuid, looksLikeServiceRoleKey } from "../bound";

describe("bound identifiers", () => {
  it("accepts a UUID and rejects injection strings", () => {
    expect(boundUuid("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")).toBe(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
    );
    expect(boundUuid("not-a-uuid")).toBeNull();
    expect(boundUuid("1; drop table profiles")).toBeNull();
    expect(boundUuid("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' OR '1'='1")).toBeNull();
  });

  it("accepts a simple slug", () => {
    expect(boundSlug("test-hardware")).toBe("test-hardware");
    expect(boundSlug("../etc/passwd")).toBeNull();
  });
});

describe("service role key detection", () => {
  it("flags secret and service_role material", () => {
    expect(looksLikeServiceRoleKey("sb_secret_abc")).toBe(true);
    expect(looksLikeServiceRoleKey("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig")).toBe(
      true
    );
    expect(looksLikeServiceRoleKey("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.sig")).toBe(false);
  });
});
