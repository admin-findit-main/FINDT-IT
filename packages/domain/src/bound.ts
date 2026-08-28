/** PostgREST binds these as parameters. We still reject anything that is not a UUID. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function boundUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

export function boundSlug(value: unknown, max = 80): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase().slice(0, max);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) return null;
  return trimmed;
}

function jwtPayload(token: string): { role?: string } | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as { role?: string };
  } catch {
    return null;
  }
}

/** True for the privileged Supabase key that must never ship to a browser. */
export function looksLikeServiceRoleKey(key: string | null | undefined): boolean {
  if (!key) return false;
  if (key.startsWith("sb_secret_")) return true;
  if (key.includes("service_role")) return true;
  const payload = jwtPayload(key);
  if (payload?.role === "service_role") return true;
  return false;
}
