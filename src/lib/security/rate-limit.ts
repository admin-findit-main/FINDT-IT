import { isDemoMode } from "@/lib/config/env";
import { requestOrigin } from "@/lib/security/request-log";

type ConsumeResult = { ok: true } | { ok: false; error: string };

const FAIL_CLOSED_BUCKETS = new Set([
  "login",
  "signup",
  "magic-link",
  "hub-pairing",
  "hub-claim",
  "create-request",
  "account-delete",
]);

function failOpenOnError(bucket: string): boolean {
  if (process.env.NODE_ENV === "production" && FAIL_CLOSED_BUCKETS.has(bucket)) {
    return false;
  }
  return true;
}

/**
 * Sliding-window counter in `rate_limit_buckets` (service role only).
 * Auth buckets fail closed in production if the table is unreachable.
 */
export async function consumeRateLimit(input: {
  bucket: string;
  limit: number;
  windowMs: number;
  key?: string;
}): Promise<ConsumeResult> {
  if (isDemoMode()) return { ok: true };

  const origin = await requestOrigin();
  const identity = input.key || origin.ip || "unknown";
  const bucketKey = `${input.bucket}:${identity}`;

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const { data: existing, error: readError } = await admin
      .from("rate_limit_buckets")
      .select("hit_count, window_started_at")
      .eq("bucket_key", bucketKey)
      .maybeSingle();
    if (readError) {
      console.error("[FINDIT] rate limit read failed", { bucket: input.bucket, ip: origin.ip });
      return failOpenOnError(input.bucket)
        ? { ok: true }
        : { ok: false, error: "Too many attempts. Wait a few minutes and try again." };
    }

    const now = Date.now();
    const started = existing?.window_started_at
      ? new Date(existing.window_started_at).getTime()
      : 0;
    const expired = !existing || now - started >= input.windowMs;
    const nextCount = expired ? 1 : Number(existing.hit_count || 0) + 1;

    if (!expired && nextCount > input.limit) {
      console.warn("[FINDIT] rate limited", {
        bucket: input.bucket,
        ip: origin.ip,
        hits: nextCount,
      });
      return { ok: false, error: "Too many attempts. Wait a few minutes and try again." };
    }

    const row = {
      bucket_key: bucketKey,
      hit_count: nextCount,
      window_started_at: expired ? new Date(now).toISOString() : existing.window_started_at,
    };
    const { error: writeError } = await admin.from("rate_limit_buckets").upsert(row, {
      onConflict: "bucket_key",
    });
    if (writeError) {
      console.error("[FINDIT] rate limit write failed", { bucket: input.bucket, ip: origin.ip });
      if (!failOpenOnError(input.bucket)) {
        return { ok: false, error: "Too many attempts. Wait a few minutes and try again." };
      }
    }
    return { ok: true };
  } catch (err) {
    console.error("[FINDIT] rate limit unavailable", err);
    return failOpenOnError(input.bucket)
      ? { ok: true }
      : { ok: false, error: "Too many attempts. Wait a few minutes and try again." };
  }
}
