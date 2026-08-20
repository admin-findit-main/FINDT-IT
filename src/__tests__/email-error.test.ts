import { describe, expect, it } from "vitest";
import { authEmailErrorMessage } from "@/lib/auth/email-error";

describe("authEmailErrorMessage", () => {
  it("asks the customer to wait when the mailer is rate limited", () => {
    expect(authEmailErrorMessage("email rate limit exceeded")).toMatch(/wait a few minutes/i);
    expect(authEmailErrorMessage("over_email_send_rate_limit")).toMatch(/sign in with your password/i);
  });

  it("passes through other auth errors", () => {
    expect(authEmailErrorMessage("User already registered")).toBe("User already registered");
  });
});
