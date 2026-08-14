import { responseLabel } from "@/lib/utils";
import {
  StatusPill,
  StatusRail,
  toneForResponse,
  type StatusTone,
} from "@/components/ui/glass";
import type { ResponseType } from "@/types/database";

/**
 * The answer a store gave. Tones come from `ui/glass`: green / amber / graphite,
 * deliberately not brand red — red means "action" everywhere else, and Out of Stock
 * is a valid answer rather than an error.
 */
export function StatusBadge({ type }: { type: ResponseType | "pending" }) {
  const tone: StatusTone = type === "pending" ? "pending" : toneForResponse(type);
  return <StatusPill tone={tone}>{type === "pending" ? "WAITING" : responseLabel(type)}</StatusPill>;
}

export function ResponseAccent({ type }: { type: ResponseType }) {
  return <StatusRail tone={toneForResponse(type)} />;
}
