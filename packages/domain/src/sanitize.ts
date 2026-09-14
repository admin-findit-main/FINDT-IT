/** Strip null bytes and other control characters from user-provided text. */
export function sanitizeText(value: string, max = 2000): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function sanitizeMultiline(value: string, max = 8000): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

const SAFE_IMAGE_EXT = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;

/**
 * Public store/customer image URLs only: https, no SVG/data/javascript,
 * no credentials in the URL, reasonable length.
 */
export function sanitizePublicHttpsImageUrl(
  raw: string | null | undefined
): string | null {
  const trimmed = sanitizeText(raw || "", 500);
  if (!trimmed) return null;
  if (/^(javascript|data|blob|file|vbscript):/i.test(trimmed)) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!SAFE_IMAGE_EXT.test(url.pathname)) return null;
  return url.toString().slice(0, 500);
}

/** App-relative deep links only (for push / SW navigation). */
export function sanitizeAppPath(
  raw: string | null | undefined,
  fallback = "/notifications"
): string {
  const trimmed = sanitizeText(raw || "", 500);
  const safeFallback =
    fallback.startsWith("/") && !fallback.startsWith("//")
      ? fallback
      : "/notifications";
  if (!trimmed) return safeFallback;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const host = url.hostname.toLowerCase();
      if (
        host !== "www.askfindit.com" &&
        host !== "askfindit.com" &&
        host !== "dashboard.askfindit.com" &&
        host !== "store.askfindit.com"
      ) {
        return safeFallback;
      }
      const path = `${url.pathname}${url.search}${url.hash}` || "/";
      if (!path.startsWith("/") || path.startsWith("//")) return safeFallback;
      return path.slice(0, 500);
    } catch {
      return safeFallback;
    }
  }
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return safeFallback;
  if (trimmed.includes("\\") || /[\s<>'"]/.test(trimmed)) return safeFallback;
  return trimmed.slice(0, 500);
}
