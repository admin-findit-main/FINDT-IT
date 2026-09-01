"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Card } from "@/components/ui/primitives";
import { customerPlanCatalog, getConsumerEntitlements } from "@/lib/config/constants";
import { CustomerPlanBilling } from "@/components/customer/billing-actions";
import { PaymentsComingSoon } from "@/components/shared/coming-soon";
import {
  getCurrentProfile,
  getCustomerPlanUsageAction,
} from "@/lib/services/actions";
import { cn } from "@/lib/utils";

export default function PlanPage() {
  const catalog = customerPlanCatalog();
  const [planId, setPlanId] = useState<"free" | "plus" | null>(null);
  const [usageLabel, setUsageLabel] = useState<string | null>(null);

  useEffect(() => {
    getCurrentProfile().then((profile) => {
      setPlanId(getConsumerEntitlements(profile?.subscription_plan).planId);
    });
    getCustomerPlanUsageAction().then((u) => {
      if (!u || u.bypassed) return;
      setUsageLabel(`${u.used} / ${u.limit} Finds used this month`);
    });
  }, []);

  const planName = planId === "plus" ? "FINDIT+" : planId === "free" ? "FINDIT" : null;

  return (
    <div className="mx-auto max-w-xl px-5 py-8 pb-12 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Plan</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        FINDIT is free. FINDIT+ is {catalog.plans[1].priceLabel} for more Finds
        and a wider search.
      </p>
      {planName ? (
        <p className="mt-3 text-sm font-medium text-ink">
          You&apos;re on {planName}
          {usageLabel ? `. ${usageLabel}.` : "."}
        </p>
      ) : (
        <p className="mt-3 text-sm font-medium text-ink-muted">Loading...</p>
      )}

      <div className="mt-6 space-y-4" role="list" aria-label="Plans">
        {catalog.plans.map((plan) => {
          const current = planId != null && plan.id === planId;
          return (
            <Card
              key={plan.id}
              role="listitem"
              aria-current={current ? "true" : undefined}
              className={cn(
                "space-y-4 p-5",
                current && "!border-2 !border-accent"
              )}
              style={
                current
                  ? { backgroundColor: "rgba(229, 35, 27, 0.28)" }
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {plan.id === "plus" ? (
                    <BrandLogo kind="plus" className="h-6 w-auto" />
                  ) : (
                    <p className="text-lg font-bold tracking-tight text-ink">
                      {plan.name}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-ink-muted">{plan.tagline}</p>
                </div>
                <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
                  {plan.priceLabel}
                </p>
              </div>
              {current ? (
                <p className="inline-flex rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-inverse">
                  Your plan
                </p>
              ) : null}

              <ul className="list-disc space-y-1.5 pl-4 text-sm text-ink">
                {plan.pros.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      {catalog.billingLive ? (
        <CustomerPlanBilling />
      ) : (
        <div className="mt-6">
          <PaymentsComingSoon />
        </div>
      )}
    </div>
  );
}
