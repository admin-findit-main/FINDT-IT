/**
 * Supabase Storage helpers for product request images.
 * Production uses `request-images` bucket — never embed base64 in production.
 */

import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/lib/config/constants";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config/env";

export const REQUEST_IMAGES_BUCKET = "request-images";

export function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

export function validateImageFile(file: {
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Use JPEG, PNG, or WEBP" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image must be under 5 MB" };
  }
  return { ok: true };
}

export function buildRequestImagePath(userId: string, fileNameHint?: string): string {
  const safeExt = (fileNameHint?.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = ["jpg", "jpeg", "png", "webp"].includes(safeExt)
    ? safeExt === "jpeg"
      ? "jpg"
      : safeExt
    : "jpg";
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${userId}/${id}.${ext}`;
}

/** Client-side compress/resize when possible (browser only). */
export async function compressImageFile(
  file: File,
  options?: { maxWidth?: number; quality?: number }
): Promise<Blob> {
  const maxWidth = options?.maxWidth ?? 1280;
  const quality = options?.quality ?? 0.82;
  if (typeof window === "undefined" || typeof createImageBitmap === "undefined") {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), mime, quality)
    );
    return blob || file;
  } catch {
    return file;
  }
}

export async function uploadRequestImage(input: {
  userId: string;
  file: Blob;
  contentType: string;
  fileNameHint?: string;
}): Promise<{ path: string; publicUrl: string } | { error: string }> {
  const validation = validateImageFile({
    type: input.contentType,
    size: input.file.size,
  });
  if (!validation.ok) return { error: validation.error };

  if (isDemoMode() || !isSupabaseConfigured()) {
    // Demo: caller may fall back to object URL / data URL separately
    return { error: "DEMO_STORAGE" };
  }

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const path = buildRequestImagePath(input.userId, input.fileNameHint);
  const { error } = await supabase.storage
    .from(REQUEST_IMAGES_BUCKET)
    .upload(path, input.file, {
      contentType: input.contentType,
      upsert: false,
    });
  if (error) return { error: error.message };

  const { data } = supabase.storage.from(REQUEST_IMAGES_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}
