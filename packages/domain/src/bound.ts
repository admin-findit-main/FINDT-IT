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

/**
 * Node's `Buffer`, read off the global instead of as a bare identifier.
 *
 * This module is imported by the React Native apps, where `Buffer` does not
 * exist: naming it directly both failed to type-check there and would have
 * thrown a ReferenceError had `atob` ever been missing.
 */
function decodeBase64(padded: string): string | null {
  if (typeof atob === "function") return atob(padded);
  const buffer = (
    globalThis as {
      Buffer?: {
        from(
          input: string,
          encoding: string
        ): { toString(encoding: string): string };
      };
    }
  ).Buffer;
  if (!buffer) return null;
  return buffer.from(padded, "base64").toString("utf8");
}

function jwtPayload(token: string): { role?: string } | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = decodeBase64(padded);
    if (json === null) return null;
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
