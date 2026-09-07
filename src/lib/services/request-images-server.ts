import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";

type StoredImage = {
  bucket: "request-images" | "product-images";
  path: string;
};

function storedImage(value: string | null | undefined): StoredImage | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    return { bucket: "request-images", path: value.replace(/^\/+/, "") };
  }
  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    for (const bucket of ["request-images", "product-images"] as const) {
      const marker = `/${bucket}/`;
      const index = pathname.indexOf(marker);
      if (index >= 0) {
        return {
          bucket,
          path: pathname.slice(index + marker.length).replace(/^\/+/, ""),
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function requestImageStoragePath(
  value: string | null | undefined
): string | null {
  return storedImage(value)?.path || null;
}

/** Short-lived URLs keep private request photos out of public storage. */
export async function signRequestImageUrls(
  values: (string | null | undefined)[],
  expiresInSeconds = 15 * 60
): Promise<Map<string, string>> {
  const parsed = values
    .map((value) => ({ value, stored: storedImage(value) }))
    .filter(
      (
        item
      ): item is {
        value: string;
        stored: StoredImage;
      } => Boolean(item.value && item.stored)
    );
  const result = new Map<string, string>();
  if (!parsed.length) return result;

  const admin = createServiceClient();
  for (const bucket of ["request-images", "product-images"] as const) {
    const bucketItems = parsed.filter((item) => item.stored.bucket === bucket);
    if (!bucketItems.length) continue;
    const paths = [...new Set(bucketItems.map((item) => item.stored.path))];
    const { data } = await admin.storage
      .from(bucket)
      .createSignedUrls(paths, expiresInSeconds);
    const signedByPath = new Map(
      (data || [])
        .filter((item) => item.signedUrl)
        .map((item) => [item.path, item.signedUrl as string])
    );
    for (const item of bucketItems) {
      const signed = signedByPath.get(item.stored.path);
      if (signed) result.set(item.value, signed);
    }
  }
  return result;
}

export async function signRequestImageUrl(
  value: string | null | undefined,
  expiresInSeconds = 15 * 60
): Promise<string | null> {
  if (!value) return null;
  const signed = await signRequestImageUrls([value], expiresInSeconds);
  return signed.get(value) || null;
}
