import { describe, expect, it } from "vitest";
import { authEmailErrorMessage } from "@/lib/auth/email-error";

describe("authEmailErrorMessage", () => {
  it("asks the customer to wait when the mailer is rate limited", () => {
    expect(authEmailErrorMessage("email rate limit exceeded")).toMatch(/wait a few minutes/i);
    expect(authEmailErrorMessage("over_email_send_rate_limit")).toMatch(/request another code/i);
  });

  it("explains mailer timeouts", () => {
    expect(authEmailErrorMessage("context deadline exceeded")).toMatch(/timed out/i);
    expect(authEmailErrorMessage("504")).toMatch(/timed out/i);
  });

  it("does not pass provider traces through to the customer", () => {
    expect(authEmailErrorMessage("User already registered")).toMatch(/try again/i);
  });
});
