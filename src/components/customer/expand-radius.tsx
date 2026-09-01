"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GlassChip } from "@/components/ui/glass";
import { useCustomerProfile } from "@/components/customer/session";
import { expandCustomerRequestRadiusAction } from "@/lib/services/actions";
import { getConsumerEntitlements, widerRadiusOptions } from "@/lib/config/constants";

export function ExpandRadiusControls({
  requestId,
  currentMiles,
  onExpanded,
}: {
  requestId: string;
  currentMiles: number;
  onExpanded?: () => void;
}) {
  const profile = useCustomerProfile();
  const entitlements = getConsumerEntitlements(profile?.subscription_plan);
  const options = widerRadiusOptions(currentMiles, entitlements.maxSearchRadiusMiles);
  const [busy, setBusy] = useState<number | null>(null);
  if (!options.length) return null;

  async function expand(miles: number) {
    if (busy) return;
    setBusy(miles);
    const result = await expandCustomerRequestRadiusAction(requestId, miles);
    setBusy(null);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Now asking stores within ${miles} miles.`);
    onExpanded?.();
  }

  return (
    <div className="mt-4 rounded-2xl border border-hairline-strong bg-white p-4 text-left">
      <p className="text-sm font-semibold text-ink">Look farther</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        Forgot {currentMiles} miles? Ask stores farther out. This still counts as
        one Find.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <GlassChip
            key={option.miles}
            disabled={busy != null}
            onClick={() => void expand(option.miles)}
          >
            {busy === option.miles ? "Asking…" : option.label}
          </GlassChip>
        ))}
      </div>
    </div>
  );
}
