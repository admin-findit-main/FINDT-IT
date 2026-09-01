/** Transactional FINDIT auth email copy + HTML. Keep in lockstep with
 * `supabase/functions/send-email/auth-email.ts`. */

export type AuthEmailAction = string;

export type AuthEmailContent = {
  subject: string;
  heading: string;
  body: string;
  button: string | null;
  footnote: string;
};

const APP_URL_FALLBACK = "https://www.askfindit.com";
const MARK_URL = "https://www.askfindit.com/brand/findit-mark-light.png";

function canonicalAppUrl(appUrl: string): string {
  const base = (appUrl || APP_URL_FALLBACK).replace(/\/$/, "");
  if (base === "https://askfindit.com" || base === "http://askfindit.com") {
    return APP_URL_FALLBACK;
  }
  return base || APP_URL_FALLBACK;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** First 4–8 digit Auth OTP in the payload. Hashes and magic-link tokens are ignored. */
export function authEmailOtpCode(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const raw of candidates) {
    const value = (raw || "").trim();
    if (/^\d{4,8}$/.test(value)) return value;
  }
  return null;
}

/** Subject like Supabase OTP mail: "123456 is your FINDIT sign-in code". */
export function authEmailSubjectWithCode(
  subject: string,
  code?: string | null
): string {
  const digits = authEmailOtpCode(code);
  return digits ? `${digits} is your FINDIT sign-in code` : subject;
}

export function otpTypeForAuthEmail(action: AuthEmailAction): string {
  if (action === "email_change_new" || action === "email_change_current") {
    return "email_change";
  }
  if (action === "signup") return "email";
  return action || "email";
}

export function authEmailConfirmationUrl(input: {
  appUrl: string;
  tokenHash: string;
  action: AuthEmailAction;
}): string {
  const base = canonicalAppUrl(input.appUrl);
  const type = otpTypeForAuthEmail(input.action);
  return `${base}/auth/callback?token_hash=${encodeURIComponent(input.tokenHash)}&type=${encodeURIComponent(type)}`;
}

export function authEmailCopy(
  action: AuthEmailAction,
  input?: { newEmail?: string; firstName?: string }
): AuthEmailContent {
  const newEmail = input?.newEmail?.trim() || "your new email";
  switch (action) {
    case "recovery":
      return {
        subject: "Reset your FINDIT password",
        heading: "Choose a new password",
        body: "We received a request to reset the password for this FINDIT account. Tap the button below to choose a new one. You’ll be signed in so you can finish resetting.",
        button: "Choose a new password",
        footnote:
          "If you didn’t request this, you can ignore this email. Your password will stay the same.",
      };
    case "magiclink":
      return {
        subject: "Your FINDIT sign-in link",
        heading: "Sign in to FINDIT",
        body: "Tap the button below to sign in. This link expires shortly and can only be used once.",
        button: "Sign in",
        footnote: "If you didn’t ask to sign in, you can ignore this email.",
      };
    case "email_otp":
      return {
        subject: "Your FINDIT sign-in code",
        heading: "Your sign-in code",
        body: "Enter this 6-digit code in FINDIT. It expires shortly and works once.",
        button: null,
        footnote: "If you didn’t ask to sign in, you can ignore this email.",
      };
    case "invite":
      return {
        subject: "You’re invited to FINDIT",
        heading: "Join your store on FINDIT",
        body: "You’ve been invited to create a FINDIT account. Tap below to accept and get started.",
        button: "Accept invitation",
        footnote: "If you weren’t expecting this, you can ignore this email.",
      };
    case "email_change":
    case "email_change_new":
    case "email_change_current":
      return {
        subject: "Confirm your new FINDIT email",
        heading: "Confirm your new email",
        body: `Tap the button below to confirm ${newEmail} as the email for this FINDIT account.`,
        button: "Confirm new email",
        footnote: "If you didn’t change your email, you can ignore this message.",
      };
    case "reauthentication":
      return {
        subject: "Your FINDIT verification code",
        heading: "Your verification code",
        body: "Use this code to confirm it’s you. It expires shortly.",
        button: null,
        footnote: "If you didn’t request this code, you can ignore this email.",
      };
    case "store_join":
      return {
        subject: "Your FINDIT store application code",
        heading: "Confirm this email",
        body: "Enter this 6-digit code on the apply page. We only create your store login and send the application after this email is confirmed.",
        button: null,
        footnote:
          "If you didn’t apply to FINDIT, you can ignore this email. Phone confirmation can come later.",
      };
    case "signup":
    case "email":
    default:
      return {
        subject: "Confirm your FINDIT email",
        heading: "Confirm your email",
        body: "Tap the button below to confirm this address and sign in to FINDIT. Nearby stores can then tell you if they have what you need. This link expires in one hour and can only be used once.",
        button: "Confirm email",
        footnote:
          "If you didn’t create a FINDIT account, you can ignore this email.",
      };
  }
}

export function renderFinditEmailHtml(input: {
  heading: string;
  body: string;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  footnote: string;
  firstName?: string | null;
  code?: string | null;
}): string {
  const greeting = input.firstName?.trim()
    ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#2E2E34;">Hi ${escapeHtml(input.firstName.trim())},</p>`
    : "";
  const button =
    input.buttonLabel && input.buttonUrl
      ? `<p style="margin:28px 0 8px;">
          <a href="${escapeHtml(input.buttonUrl)}" style="display:inline-block;background:#E5231B;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:16px;line-height:1;padding:14px 24px;border-radius:999px;">${escapeHtml(input.buttonLabel)}</a>
        </p>
        <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6E6E78;word-break:break-all;">Or paste this link into your browser:<br>${escapeHtml(input.buttonUrl)}</p>`
      : "";
  const code = input.code
    ? `<p style="margin:24px 0 6px;font-size:13px;line-height:1.4;color:#6E6E78;text-align:center;">Your code</p>
        <p style="margin:0 0 8px;font-size:36px;line-height:1.2;font-weight:700;color:#0B0B0C;text-align:center;font-family:Menlo,Consolas,'Courier New',monospace;">${escapeHtml(input.code)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FINDIT</title>
</head>
<body style="margin:0;padding:0;background:#F2F2F7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F2F2F7;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;">
          <tr>
            <td style="padding:0 8px 20px;">
              <img src="${MARK_URL}" width="36" height="36" alt="FINDIT" style="display:block;border:0;">
              <div style="margin-top:10px;font-size:12px;letter-spacing:0.22em;font-weight:700;color:#E5231B;">FINDIT</div>
            </td>
          </tr>
          <tr>
            <td style="background:#FFFFFF;border:1px solid #E2E2E6;border-radius:20px;padding:36px 32px;">
              ${greeting}
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#0B0B0C;font-weight:700;">${escapeHtml(input.heading)}</h1>
              <p style="margin:0;font-size:16px;line-height:1.6;color:#4A4A52;">${escapeHtml(input.body)}</p>
              ${code}
              ${button}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 0;font-size:12px;line-height:1.6;color:#6E6E78;">
              ${escapeHtml(input.footnote)}<br><br>
              FINDIT · ask nearby stores if they have it<br>
              <a href="${APP_URL_FALLBACK}" style="color:#6E6E78;">askfindit.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderFinditEmailText(input: {
  heading: string;
  body: string;
  buttonUrl?: string | null;
  footnote: string;
  firstName?: string | null;
  code?: string | null;
}): string {
  const hi = input.firstName?.trim() ? `Hi ${input.firstName.trim()},\n\n` : "";
  const code = input.code ? `\n\nCode: ${input.code}\n` : "";
  const link = input.buttonUrl ? `\n\n${input.buttonUrl}\n` : "";
  return `${hi}${input.heading}\n\n${input.body}${code}${link}\n${input.footnote}\n\nFINDIT · https://askfindit.com\n`;
}
