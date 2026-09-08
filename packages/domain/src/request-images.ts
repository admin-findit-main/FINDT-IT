const HTTP_URL = /^https?:\/\//i;

/**
 * Normalize a private request-image object path and prove that it belongs to
 * the authenticated customer. Public/external URLs and traversal-like paths
 * are never accepted as persisted request images.
 */
export function normalizeOwnedRequestImagePath(
  value: string | null | undefined,
  customerId: string
): string | null {
  if (!value || !customerId || HTTP_URL.test(value) || value.startsWith("data:")) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  const path = decoded.replace(/^\/+/, "");
  const parts = path.split("/");
  if (
    parts.length < 2 ||
    parts.some((part) => !part || part === "." || part === "..") ||
    path.includes("\\") ||
    parts[0] !== customerId
  ) {
    return null;
  }
  return parts.join("/");
}

export function resolveOwnedRequestImageInput(input: {
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  customerId: string;
}): { path: string | null } | { error: string } {
  const supplied = [input.imageStoragePath, input.imageUrl].filter(
    (value): value is string => Boolean(value)
  );
  if (!supplied.length) return { path: null };

  const normalized = supplied.map((value) =>
    normalizeOwnedRequestImagePath(value, input.customerId)
  );
  if (
    normalized.some((value) => !value) ||
    new Set(normalized).size !== 1
  ) {
    return { error: "Please upload the photo again." };
  }
  return { path: normalized[0] };
}
