export const DEMO_EMAIL_OTP = "123456";

export type EmailNormalizeResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim, lowercase, and reject empty or malformed addresses. */
export function normalizeEmail(input: string): EmailNormalizeResult {
  const email = input.trim().toLowerCase();
  if (!email) return { ok: false, error: "Enter your email" };
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Enter a valid email" };
  }
  return { ok: true, email };
}

/** jane.shopper@gmail.com → j•••@gmail.com */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}•••@${domain}`;
}

export function mapEmailOtpError(
  message: string | null | undefined,
  kind: "send" | "verify"
): string {
  const text = (message || "").toLowerCase();
  if (!text) {
    return kind === "send"
      ? "We couldn't send a code. Try again."
      : "That code didn't work. Try again.";
  }
  if (
    text.includes("fetch") ||
    text.includes("network") ||
    text.includes("failed to fetch")
  ) {
    return "Check your connection and try again.";
  }
  if (text.includes("invalid") && text.includes("email")) {
    return "Enter a valid email.";
  }
  if (text.includes("signups not allowed") || text.includes("user not found")) {
    return "No FINDIT account for this email yet. Sign up to continue.";
  }
  if (
    text.includes("expired") ||
    text.includes("otp_expired") ||
    text.includes("token has expired")
  ) {
    return "That code expired. Request a new one.";
  }
  if (
    text.includes("invalid") &&
    (text.includes("token") || text.includes("otp") || text.includes("code"))
  ) {
    return "That code is incorrect.";
  }
  if (
    text.includes("rate") ||
    text.includes("too many") ||
    text.includes("over_email")
  ) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return kind === "send"
    ? "We couldn't send a code. Try again."
    : "That code didn't work. Try again.";
}
