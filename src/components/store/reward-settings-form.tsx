"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { IosSwitch } from "@/components/ui/ios-switch";
import { updateStoreRewardSettingsAction } from "@/lib/services/loyalty";

export function RewardSettingsForm({
  initial,
}: {
  initial: {
    enabled: boolean;
    pointsPerDollar: number;
    pointsPerPurchase: number;
    rewardThresholdPoints: number;
    rewardValueCents: number;
  };
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [pointsPerDollar, setPointsPerDollar] = useState(
    initial.pointsPerDollar
  );
  const [legacyPoints, setLegacyPoints] = useState(initial.pointsPerPurchase);
  const [threshold, setThreshold] = useState(initial.rewardThresholdPoints);
  const [valueDollars, setValueDollars] = useState(
    (initial.rewardValueCents / 100).toFixed(2)
  );
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        const dollars = Number(valueDollars);
        const result = await updateStoreRewardSettingsAction({
          enabled,
          pointsPerDollar,
          pointsPerPurchase: legacyPoints,
          rewardThresholdPoints: threshold,
          rewardValueCents: Number.isFinite(dollars)
            ? Math.round(dollars * 100)
            : -1,
        });
        setSaving(false);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Reward settings saved");
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => setEnabled((value) => !value)}
        className="flex min-h-12 w-full items-center justify-between gap-4 border border-hairline-strong px-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold">Store rewards</span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            Points are funded by this store, not by FINDIT.
          </span>
        </span>
        <IosSwitch decorative label="Store rewards" checked={enabled} />
      </button>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="points-per-dollar">Points per dollar</Label>
          <Input
            id="points-per-dollar"
            type="number"
            min={1}
            max={1000}
            value={pointsPerDollar}
            onChange={(event) =>
              setPointsPerDollar(Number(event.target.value))
            }
          />
          <p className="mt-1 text-xs text-ink-muted">
            Used for amount purchases entered in Hub.
          </p>
        </div>
        <div>
          <Label htmlFor="points-per-purchase">
            Points per request purchase
          </Label>
          <Input
            id="points-per-purchase"
            type="number"
            min={1}
            max={1000}
            value={legacyPoints}
            onChange={(event) =>
              setLegacyPoints(Number(event.target.value))
            }
          />
          <p className="mt-1 text-xs text-ink-muted">
            Kept for the legacy request-confirmation flow.
          </p>
        </div>
        <div>
          <Label htmlFor="reward-threshold">Points for a reward</Label>
          <Input
            id="reward-threshold"
            type="number"
            min={1}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="reward-value">Reward value ($)</Label>
          <Input
            id="reward-value"
            inputMode="decimal"
            value={valueDollars}
            onChange={(event) => setValueDollars(event.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-ink-muted">
        Example: {threshold} points = ${Number(valueDollars || 0).toFixed(2)}.
        Redemption is recorded by the store; FINDIT does not reimburse this value.
      </p>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save rewards"}
      </Button>
    </form>
  );
}
