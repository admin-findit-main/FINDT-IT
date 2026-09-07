"use client";

import { useEffect, useState } from "react";
import { isStoreOpenAt } from "@/lib/services/store-hours";
import { greetingForHour } from "@/lib/utils";
import type { StoreOverview } from "@/lib/services/store-overview";

type OwnerHours = Extract<StoreOverview, { mode: "owner" }>["hours"];

/**
 * The two labels on the owner dashboard that must read the viewer's clock.
 *
 * `greetingForHour` and `isStoreOpenAt` both call getHours()/getDay(), which
 * resolve in the runtime's timezone -- UTC on Vercel. Rendering them in the
 * server component that now fetches the rest of this page would tell a
 * Virginia owner "Good evening" over lunch and could report a store closed
 * while its doors are open.
 *
 * Computing them after mount also keeps the server and client passes
 * agreeing, so neither triggers a hydration mismatch.
 */
export function StoreGreeting() {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(greetingForHour());
  }, []);

  // Non-breaking space holds the line's height so the heading below does not
  // jump when the greeting appears.
  return <p className="text-sm text-ink-muted">{greeting ?? "\u00A0"}</p>;
}

export function StoreOpenLabel({ hours }: { hours: OwnerHours }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!hours?.length) {
      setLabel(null);
      return;
    }
    setLabel(isStoreOpenAt(hours).open ? "Open" : "Closed");
  }, [hours]);

  if (!label) return null;
  return <p className="mt-1 text-sm text-ink-muted">{label}</p>;
}
