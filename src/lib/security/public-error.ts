const SAFE =
  /unauthorized|sign in|password|email|try again|too many|invalid|required|not found|already|confirm|network|offline|permission|expired|verify/i;

/** User-facing copy only — never a stack, SQL, or provider trace. */
export function toPublicError(err: unknown, fallback = "Something went wrong. Try again."): string {
  if (typeof err === "string") {
    const text = err.trim();
    if (!text) return fallback;
    if (isLeaky(text)) return fallback;
    if (text.length > 180) return fallback;
    return SAFE.test(text) || text.length < 80 ? text : fallback;
  }
  if (err && typeof err === "object" && "error" in err) {
    return toPublicError((err as { error?: unknown }).error, fallback);
  }
  if (err instanceof Error) {
    if (isLeaky(err.message)) return fallback;
    return toPublicError(err.message, fallback);
  }
  return fallback;
}

function isLeaky(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("stack") ||
    lower.includes("at http") ||
    lower.includes("postgres") ||
    lower.includes("permission denied for") ||
    lower.includes("column") ||
    lower.includes("relation") ||
    lower.includes("jwt") ||
    lower.includes("service role") ||
    lower.includes("supabase") ||
    lower.includes("code:") ||
    lower.includes("pgrst") ||
    /\b\d{3}:/.test(text)
  );
}
