import { describe, expect, it } from "vitest";
import {
  authEmailConfirmationUrl,
  authEmailCopy,
  authEmailOtpCode,
  escapeHtml,
  otpTypeForAuthEmail,
  renderFinditEmailHtml,
  renderFinditEmailText,
} from "../auth-email";

describe("auth email", () => {
  it("sends signup confirms through the app callback", () => {
    expect(otpTypeForAuthEmail("signup")).toBe("email");
    expect(
      authEmailConfirmationUrl({
        appUrl: "https://askfindit.com",
        tokenHash: "abc",
        action: "signup",
      })
    ).toBe("https://www.askfindit.com/auth/callback?token_hash=abc&type=email");
    expect(
      authEmailConfirmationUrl({
        appUrl: "https://www.askfindit.com",
        tokenHash: "abc",
        action: "magiclink",
      })
    ).toBe("https://www.askfindit.com/auth/callback?token_hash=abc&type=magiclink");
  });

  it("uses a confirm subject customers can trust", () => {
    expect(authEmailCopy("signup").subject).toBe("Confirm your FINDIT email");
    expect(authEmailCopy("recovery").button).toBe("Choose a new password");
    expect(authEmailCopy("store_join").button).toBeNull();
    expect(authEmailCopy("store_join").body).toMatch(/6-digit code/i);
    expect(authEmailCopy("email_otp").button).toBeNull();
    expect(authEmailCopy("email_otp").body).toMatch(/6-digit code/i);
  });

  it("escapes names inside HTML", () => {
    const html = renderFinditEmailHtml({
      heading: "Confirm your email",
      body: "Tap below",
      buttonLabel: "Confirm email",
      buttonUrl: "https://askfindit.com/auth/callback",
      footnote: "Ignore if unexpected",
      firstName: '<img src=x>',
    });
    expect(html).toContain("Hi &lt;img src=x&gt;,");
    expect(html).toContain("FINDIT");
    expect(html).toContain("#E5231B");
  });

  it("escapes markup in copy", () => {
    expect(escapeHtml('<b>x</b>')).toBe("&lt;b&gt;x&lt;/b&gt;");
  });

  it("picks a 6-digit OTP and ignores hashes", () => {
    expect(authEmailOtpCode("123456")).toBe("123456");
    expect(authEmailOtpCode("  847291  ", "abc")).toBe("847291");
    expect(authEmailOtpCode("7d5b7b1964cf5d388340a7f04f1dbb5eeb6c7b52ef8270e1737a58d0")).toBeNull();
    expect(authEmailOtpCode("", undefined, "12")).toBeNull();
  });

  it("renders the digits in HTML and text", () => {
    const input = {
      heading: "Your sign-in code",
      body: "Enter this 6-digit code in FINDIT.",
      footnote: "Ignore if unexpected",
      code: "123456",
    };
    expect(renderFinditEmailHtml(input)).toContain("123456");
    expect(renderFinditEmailText(input)).toContain("Code: 123456");
  });
});
