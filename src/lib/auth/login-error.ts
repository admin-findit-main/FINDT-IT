const LOGIN_ERROR_COPY: Record<string, string> = {
  auth_callback:
    "That email link is invalid or already used. Request a new 6-digit code.",
  account_suspended: "This account is paused. Contact FINDIT if that looks wrong.",
};

export function publicLoginError(code: string | null | undefined): string | null {
  if (!code) return null;
  return (
    LOGIN_ERROR_COPY[code] ||
    "Could not sign you in. Try again or request a new 6-digit code."
  );
}
