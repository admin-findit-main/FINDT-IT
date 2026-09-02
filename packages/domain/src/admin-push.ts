import { sanitizeMultiline, sanitizeText } from "./sanitize";

export const ADMIN_PUSH_AUDIENCES = [
  "all",
  "shoppers",
  "store_owners",
  "employees",
] as const;

export type AdminPushAudience = (typeof ADMIN_PUSH_AUDIENCES)[number];

export const ADMIN_PUSH_TITLE_MAX = 80;
export const ADMIN_PUSH_BODY_MAX = 280;

export function isAdminPushAudience(value: string): value is AdminPushAudience {
  return (ADMIN_PUSH_AUDIENCES as readonly string[]).includes(value);
}

export function adminPushAudienceLabel(audience: AdminPushAudience): string {
  switch (audience) {
    case "all":
      return "All users";
    case "shoppers":
      return "Shoppers";
    case "store_owners":
      return "Store owners";
    case "employees":
      return "Employees";
  }
}

export function defaultAdminPushUrl(audience: AdminPushAudience): string {
  if (audience === "store_owners" || audience === "employees") return "/store";
  return "/home";
}

const FINDIT_HOSTS = new Set([
  "www.askfindit.com",
  "askfindit.com",
  "dashboard.askfindit.com",
  "store.askfindit.com",
]);

/** Same-origin path only. External and javascript URLs fall back. */
export function sanitizeAdminPushUrl(raw: string, fallback: string): string {
  const trimmed = sanitizeText(raw, 500);
  const safeFallback = fallback.startsWith("/") && !fallback.startsWith("//")
    ? fallback
    : "/home";
  if (!trimmed) return safeFallback;

  let path = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (!FINDIT_HOSTS.has(url.hostname.toLowerCase())) return safeFallback;
      path = `${url.pathname}${url.search}${url.hash}` || "/";
    } catch {
      return safeFallback;
    }
  }

  if (!path.startsWith("/") || path.startsWith("//")) return safeFallback;
  if (path.includes("\\") || /[\s<>'"]/.test(path)) return safeFallback;
  return path.slice(0, 500);
}

export function parseAdminPushCopy(input: {
  title: string;
  body: string;
  url?: string;
  audience: AdminPushAudience;
}): { title: string; body: string; url: string } | { error: string } {
  const title = sanitizeText(input.title, ADMIN_PUSH_TITLE_MAX);
  const body = sanitizeMultiline(input.body, ADMIN_PUSH_BODY_MAX).replace(/\s+/g, " ");
  if (!title) return { error: "Enter a title." };
  if (!body) return { error: "Enter a message." };
  return {
    title,
    body,
    url: sanitizeAdminPushUrl(input.url || "", defaultAdminPushUrl(input.audience)),
  };
}
