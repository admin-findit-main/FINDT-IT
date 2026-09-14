"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { IosSwitch } from "@/components/ui/ios-switch";
import { updateStoreRewardSettingsAction } from "@/lib/services/loyalty";

export function RewardSettingsForm({
  storeName,
  initial,
}: {
  storeName: string;
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    const spend = 50;
    const earned = Math.max(0, Math.floor(spend * (Number(pointsPerDollar) || 0)));
    return { spend, earned };
  }, [pointsPerDollar]);

  return (
    <form
      className="space-y-6"
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
        toast.success(`Rewards saved for ${storeName}`);
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => setEnabled((value) => !value)}
        className="flex min-h-12 w-full items-center justify-between gap-4 rounded-xl border border-hairline-strong px-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold">
            Enable rewards at {storeName}
          </span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            These points are funded by this store, not FINDIT.
          </span>
        </span>
        <IosSwitch decorative label="Store rewards" checked={enabled} />
      </button>

      <div
        className={
          enabled ? "space-y-6" : "pointer-events-none space-y-6 opacity-50"
        }
      >
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">Earn rate</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Awarded when Hub confirms a purchase amount at this location.
            </p>
          </div>
          <div>
            <Label htmlFor="points-per-dollar">Points per dollar spent</Label>
            <Input
              id="points-per-dollar"
              type="number"
              min={1}
              max={1000}
              value={pointsPerDollar}
              onChange={(event) =>
                setPointsPerDollar(Number(event.target.value))
              }
              className="mt-1.5"
            />
          </div>
        </section>

        <div className="rounded-xl border border-hairline-strong bg-black/[0.03] px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            Preview for {storeName}
          </p>
          <p className="mt-2 text-sm text-ink">
            A ${preview.spend} purchase earns{" "}
            <span className="font-semibold">{preview.earned} points</span>.
            Add named prizes in Redeemable rewards below.
          </p>
        </div>

        <div>
          <button
            type="button"
            className="text-sm font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide advanced" : "Advanced"}
          </button>
          {showAdvanced ? (
            <div className="mt-3 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="reward-threshold">Legacy points threshold</Label>
                  <Input
                    id="reward-threshold"
                    type="number"
                    min={1}
                    value={threshold}
                    onChange={(event) => setThreshold(Number(event.target.value))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="reward-value">Legacy reward value ($)</Label>
                  <Input
                    id="reward-value"
                    inputMode="decimal"
                    value={valueDollars}
                    onChange={(event) => setValueDollars(event.target.value)}
                    className="mt-1.5"
                  />
                </div>
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
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-ink-muted">
                  Older request-confirm flow only. Prefer the reward menu for
                  prizes.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save earn rate"}
      </Button>
    </form>
  );
}
