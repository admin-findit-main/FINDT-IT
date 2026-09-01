export const OTP_RESEND_SECONDS = 60;
export const DEMO_PHONE_OTP = "123456";
export const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

/** Phone OTP stays in the codebase, but the UI and send/verify paths stay off until SMS is ready. */
export const PHONE_OTP_ENABLED = false;
export const PHONE_OTP_DISABLED_MESSAGE =
  "Text codes are paused for now. Use your email instead.";

export type PhoneNormalizeResult =
  | { ok: true; e164: string }
  | { ok: false; error: string };

/** Normalize a US-first phone string to E.164. Accepts +E.164 for other countries. */
export function normalizePhoneToE164(input: string): PhoneNormalizeResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter your phone number" };

  const digits = raw.replace(/\D/g, "");
  if (!digits) return { ok: false, error: "Enter a valid phone number" };

  let e164: string;
  if (raw.startsWith("+")) {
    e164 = `+${digits}`;
  } else if (digits.length === 10) {
    e164 = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    e164 = `+${digits}`;
  } else {
    return {
      ok: false,
      error: "Enter a valid US number, or include the country code",
    };
  }

  if (!E164_PATTERN.test(e164)) {
    return { ok: false, error: "Enter a valid phone number" };
  }
  return { ok: true, e164 };
}

/** +17035551234 → +1••••1234 */
export function maskPhoneE164(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const last4 = digits.slice(-4) || "••••";
  if (e164.startsWith("+1") || digits.length === 11) return `+1••••${last4}`;
  const cc = e164.match(/^\+(\d{1,3})/)?.[1] || "";
  return `+${cc}••••${last4}`;
}

export function formatUsNationalInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function customerNeedsFirstName(profile: {
  first_name?: string | null;
  account_type?: string | null;
}): boolean {
  return profile.account_type === "customer" && !profile.first_name?.trim();
}

export function accountContactLabel(profile: {
  email?: string | null;
  phone_e164?: string | null;
}): string {
  if (profile.email?.trim()) return profile.email.trim();
  if (profile.phone_e164) return maskPhoneE164(profile.phone_e164);
  return "No contact on file";
}

export function mapPhoneOtpError(
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
  if (
    text.includes("invalid") &&
    (text.includes("phone") || text.includes("mobile"))
  ) {
    return "Enter a valid phone number.";
  }
  if (text.includes("signups not allowed") || text.includes("user not found")) {
    return "No FINDIT account for this number yet. Sign up to continue.";
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
    text.includes("over_sms")
  ) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (
    text.includes("phone_provider_disabled") ||
    text.includes("unsupported phone provider") ||
    (text.includes("sms") && text.includes("provider"))
  ) {
    return "Text codes aren't set up yet. Finish Twilio in Supabase Auth → Phone.";
  }
  if (text.includes("sms") && text.includes("send")) {
    return "We couldn't send a text right now. Try again in a moment.";
  }
  return kind === "send"
    ? "We couldn't send a code. Try again."
    : "That code didn't work. Try again.";
}
