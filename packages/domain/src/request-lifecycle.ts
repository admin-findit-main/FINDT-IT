/**
 * Request lifecycle helpers — status transitions & timing metrics.
 */

import type { RequestStatus, ResponseType } from "@findit/types";

export const REQUEST_DEFAULT_EXPIRATION_HOURS = 24;
export const REQUEST_MAX_EXPIRATION_HOURS = 48;
export const STILL_LOOKING_COOLDOWN_HOURS = 4;
export const STILL_LOOKING_MAX_REBROADCASTS = 2;
export const DUPLICATE_REQUEST_WINDOW_MINUTES = 15;
export const RESPONSE_COOLDOWN_SECONDS = 3;

export type LifecycleStatus = Extract<
  RequestStatus,
  "active" | "partially_answered" | "answered" | "fulfilled" | "expired" | "cancelled"
>;

export function deriveRequestStatus(input: {
  current?: RequestStatus;
  responseCount: number;
  targetCount: number;
  hasInStock?: boolean;
  expired?: boolean;
  cancelled?: boolean;
  fulfilled?: boolean;
}): LifecycleStatus {
  if (input.fulfilled) return "fulfilled";
  if (input.cancelled) return "cancelled";
  if (input.expired) return "expired";
  if (input.responseCount <= 0) return "active";
  if (input.targetCount > 0 && input.responseCount >= input.targetCount) {
    return "answered";
  }
  return "partially_answered";
}

export function isActivelySearching(status: RequestStatus): boolean {
  return ["active", "partially_answered", "answered"].includes(status);
}

export function responseTimeSeconds(
  routeSentAt: string | Date,
  respondedAt: string | Date = new Date()
): number {
  const start = typeof routeSentAt === "string" ? new Date(routeSentAt) : routeSentAt;
  const end = typeof respondedAt === "string" ? new Date(respondedAt) : respondedAt;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

export function median(numbers: number[]): number | null {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

export function average(numbers: number[]): number | null {
  if (!numbers.length) return null;
  return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
}

export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function canRebroadcastStillLooking(input: {
  status: RequestStatus;
  expiresAt: string;
  stillLookingCount: number;
  lastRebroadcastAt: string | null;
  now?: Date;
}): { ok: boolean; reason?: string } {
  const now = input.now || new Date();
  if (!isActivelySearching(input.status) && input.status !== "answered") {
    return { ok: false, reason: "This request is no longer active." };
  }
  if (new Date(input.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: "This request has expired." };
  }
  if (input.stillLookingCount >= STILL_LOOKING_MAX_REBROADCASTS) {
    return { ok: false, reason: "You've already rebroadcast this request the maximum times." };
  }
  if (input.lastRebroadcastAt) {
    const next =
      new Date(input.lastRebroadcastAt).getTime() +
      STILL_LOOKING_COOLDOWN_HOURS * 60 * 60 * 1000;
    if (now.getTime() < next) {
      return {
        ok: false,
        reason: `You can ask stores again in about ${STILL_LOOKING_COOLDOWN_HOURS} hours.`,
      };
    }
  }
  return { ok: true };
}

export function isNearDuplicateRequest(input: {
  normalizedProductName: string;
  category: string | null | undefined;
  existing: {
    id?: string;
    normalized_product_name: string;
    category: string | null;
    status: RequestStatus;
    created_at: string;
  }[];
  windowMinutes?: number;
  now?: Date;
}): { duplicate: boolean; existingId?: string } {
  const windowMs = (input.windowMinutes ?? DUPLICATE_REQUEST_WINDOW_MINUTES) * 60 * 1000;
  const now = input.now || new Date();
  for (const r of input.existing) {
    if (!isActivelySearching(r.status)) continue;
    if (r.normalized_product_name !== input.normalizedProductName) continue;
    const sameCat =
      (!r.category && !input.category) ||
      (r.category || "").toLowerCase() === (input.category || "").toLowerCase();
    if (!sameCat) continue;
    if (now.getTime() - new Date(r.created_at).getTime() <= windowMs) {
      return { duplicate: true, existingId: r.id };
    }
  }
  return { duplicate: false };
}

export function rankResponseType(type: ResponseType | string): number {
  switch (type) {
    case "in_stock":
      return 0;
    case "can_order":
      return 1;
    case "out_of_stock":
      return 2;
    default:
      return 9;
  }
}
