import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  destinationAfterEmailLink,
  isPasswordUpdatePath,
  isRecoveryAuthType,
  isSafeNextPath,
  PASSWORD_UPDATE_PATH,
  type AppHomePath,
} from "@/lib/auth/home-path";
import { getAppWorkspaceAction } from "@/lib/services/actions";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export function parseEmailOtpType(
  type: string | null | undefined
): EmailOtpType | null {
  if (!type) return null;
  return EMAIL_OTP_TYPES.has(type as EmailOtpType)
    ? (type as EmailOtpType)
    : null;
}

function recentlyRequestedPasswordReset(recoverySentAt?: string | null): boolean {
  if (!recoverySentAt) return false;
  const sent = Date.parse(recoverySentAt);
  return Number.isFinite(sent) && Date.now() - sent < 30 * 60 * 1000;
}

function hashParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export async function completeEmailAuthLink(): Promise<{ error?: string }> {
  const url = new URL(window.location.href);
  const hash = hashParams();
  const supabase = createClient();

  const errorParam =
    url.searchParams.get("error_description") ||
    url.searchParams.get("error") ||
    hash.get("error_description") ||
    hash.get("error");
  if (errorParam && errorParam !== "auth_callback") {
    return { error: errorParam.replace(/\+/g, " ") };
  }

  const tokenHash =
    url.searchParams.get("token_hash") || hash.get("token_hash");
  const type =
    parseEmailOtpType(url.searchParams.get("type")) ||
    parseEmailOtpType(hash.get("type"));
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) return { error: error.message };
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { error: error.message };
  } else if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { error: error.message };
  } else {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return { error: "This link is invalid or has already been used." };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This link is invalid or has already been used." };
  }

  if (
    isRecoveryAuthType(type) ||
    (isSafeNextPath(next) && isPasswordUpdatePath(next)) ||
    recentlyRequestedPasswordReset(user.recovery_sent_at)
  ) {
    window.location.replace(PASSWORD_UPDATE_PATH);
    return {};
  }

  const workspace = await getAppWorkspaceAction();
  window.location.replace(
    destinationAfterEmailLink({
      type,
      next,
      email: user.email,
      homePath: (workspace?.homePath || "/home") as AppHomePath,
    })
  );
  return {};
}
