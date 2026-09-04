"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import {
  getAdminBillingConfigAction,
  saveAdminBillingConfigAction,
} from "@/lib/visits/engine";
import { formatCents, type UsagePricingConfig } from "@findit/domain";

export function AdminUsagePricingForm() {
  const [config, setConfig] = useState<UsagePricingConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getAdminBillingConfigAction().then(setConfig);
  }, []);

  if (!config) {
    return <p className="text-sm text-ink-muted">Loading pricing…</p>;
  }

  function field<K extends keyof UsagePricingConfig>(
    key: K,
    label: string,
    hint?: string
  ) {
    const value = config![key];
    const numeric = typeof value === "number" || value === null;
    if (!numeric && typeof value !== "boolean") return null;
    if (typeof value === "boolean") {
      return (
        <label key={key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) =>
              setConfig((cur) => (cur ? { ...cur, [key]: e.target.checked } : cur))
            }
          />
          {label}
        </label>
      );
    }
    return (
      <div key={key}>
        <Label>{label}</Label>
        <Input
          inputMode="numeric"
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            setConfig((cur) =>
              cur
                ? {
                    ...cur,
                    [key]:
                      raw === "" && key === "employeePoolMaxCents"
                        ? null
                        : Number(raw),
                  }
                : cur
            );
          }}
        />
        {hint ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage(null);
        const result = await saveAdminBillingConfigAction(config);
        setBusy(false);
        setMessage("error" in result ? result.error : "Saved. Charges stay off.");
      }}
    >
      <p className="text-sm text-ink-muted">
        Current starter quote: {formatCents(config.baseMonthlyCents)}/month +{" "}
        {formatCents(config.visitCents)} per verified visit, capped at{" "}
        {formatCents(config.paygMaxCents)}. Payment collection stays disabled.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("baseMonthlyCents", "Base monthly (cents)", "$18.99 is 1899")}
        {field("visitCents", "Verified visit (cents)", "$0.25 is 25")}
        {field("paygMaxVisits", "Pay-as-you-grow visit cap")}
        {field("paygMaxCents", "Pay-as-you-grow bill cap (cents)")}
        {field("growthMinVisits", "Growth min visits")}
        {field("growthMaxVisits", "Growth max visits")}
        {field("growthMonthlyCents", "Growth monthly (cents)")}
        {field("businessMinVisits", "Business min visits")}
        {field("businessMaxVisits", "Business max visits")}
        {field("businessMonthlyCents", "Business monthly (cents)")}
        {field("highVolumeMinVisits", "High volume min visits")}
        {field("highVolumeMaxVisits", "High volume max visits")}
        {field("highVolumeMonthlyCents", "High volume monthly (cents)")}
        {field("enterpriseMinVisits", "Enterprise min visits")}
        {field("trialDays", "Trial days")}
        {field("employeePoolPercent", "Employee pool % of eligible revenue")}
        {field("employeePoolMaxCents", "Employee pool max (cents, blank = none)")}
        {field("employeePoolEnabled", "Employee reward pool enabled")}
        {field("shopperPointsPerVisit", "Shopper points per verified visit")}
        {field("employeePointsPerVisit", "Employee points per verified visit")}
        {field(
          "shopperMaxRewardedCheckinsPerDay",
          "Max rewarded shopper check-ins / day"
        )}
      </div>
      <Button type="submit" disabled={busy}>
        Save usage pricing
      </Button>
      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
    </form>
  );
}
