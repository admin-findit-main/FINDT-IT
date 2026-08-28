/** Maps Supabase Auth mailer errors to a wait-and-retry message. */
export function authEmailErrorMessage(error: string | null | undefined): string {
  const text = (error || "").toLowerCase();
  if (
    text.includes("rate limit") ||
    text.includes("over_email_send_rate_limit") ||
    text.includes("email rate limit exceeded")
  ) {
    return "Too many emails were just sent. Wait a few minutes, then request another link. You can still sign in with your password.";
  }
  if (
    text.includes("timeout") ||
    text.includes("deadline") ||
    text.includes("504") ||
    text.includes("context deadline exceeded")
  ) {
    return "Email delivery timed out. Try signing in with your password, or create the account again in a minute.";
  }
  return "Could not send email. Try again in a moment.";
}
