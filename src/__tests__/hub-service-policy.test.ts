import { describe, expect, it } from "vitest";
import {
  hasVerifiedEmailIdentity,
  isWaitingHubRequest,
} from "@/lib/services/hub-policy";

describe("Hub service privacy policy", () => {
  it("requires verified email identity without requiring a verified phone", () => {
    expect(
      hasVerifiedEmailIdentity({
        email_confirmed_at: "2026-09-08T00:00:00.000Z",
      })
    ).toBe(true);
    expect(hasVerifiedEmailIdentity({ email_confirmed_at: null })).toBe(false);
  });

  it("counts only live, unanswered, relevant delivered requests", () => {
    const base = {
      respondedAt: null,
      deliveryStatus: "sent",
      relevant: true,
      requestStatus: "active",
      expiresAt: "2026-09-08T02:00:00.000Z",
      nowMs: new Date("2026-09-08T01:00:00.000Z").getTime(),
    };

    expect(isWaitingHubRequest(base)).toBe(true);
    expect(isWaitingHubRequest({ ...base, respondedAt: base.expiresAt })).toBe(false);
    expect(isWaitingHubRequest({ ...base, relevant: false })).toBe(false);
    expect(isWaitingHubRequest({ ...base, requestStatus: "answered" })).toBe(false);
    expect(
      isWaitingHubRequest({
        ...base,
        expiresAt: "2026-09-08T00:00:00.000Z",
      })
    ).toBe(false);
  });
});
