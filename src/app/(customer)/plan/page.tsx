"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import {
  customerPlanCatalog,
  getConsumerEntitlements,
} from "@/lib/config/constants";
import { CustomerPlanBilling } from "@/components/customer/billing-actions";
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
        FINDIT is free. FINDIT+ is ${catalog.plans[1].priceLabel} for more
        Finds and a wider search. Live shopper billing is off until launch.
      </p>
      {planName ? (
        <p className="mt-3 text-sm font-medium text-ink">
          You&apos;re on {planName}
          {usageLabel ? `. ${usageLabel}.` : "."}
        </p>
      ) : (
        <p className="mt-3 text-sm font-medium text-ink-muted">Loading your plan…</p>
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
                  <p className="mt-1 text-sm text-ink">{plan.who}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-3">
                  <p className="text-right text-sm font-semibold tabular-nums text-ink">
                    {plan.priceLabel}
                  </p>
                  <span
                    aria-hidden
                    className={cn(
                      "grid h-[22px] w-[22px] place-items-center rounded-full border-2",
                      current ? "border-accent" : "border-hairline"
                    )}
                  >
                    {current ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                    ) : null}
                  </span>
                </div>
              </div>
              {current ? (
                <p className="inline-flex rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-inverse">
                  Your plan
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Pros
                  </p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-ink">
                    {plan.pros.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Cons
                  </p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-ink-muted">
                    {plan.cons.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <CustomerPlanBilling />

      <Card level="subtle" className="mt-4 space-y-3 p-5">
        <p className="text-sm font-semibold text-ink">{catalog.business.name}</p>
        <p className="text-sm font-medium text-ink">{catalog.business.priceLabel}</p>
        <p className="text-sm leading-relaxed text-ink-muted">
          {catalog.business.detail}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/join">Apply your business</Link>
        </Button>
      </Card>
    </div>
  );
}
