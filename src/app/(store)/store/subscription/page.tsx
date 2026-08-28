"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/dashboard/shell";
import { Skeleton } from "@/components/ui/primitives";
import { STORE_PLANS, STORE_TRIAL_DAYS } from "@/lib/config/constants";
import { getStoreWorkspaceAction } from "@/lib/services/actions";
import type { Store } from "@/types/database";

export default function StoreSubscriptionPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStoreWorkspaceAction().then((ws) => {
      setStore(ws?.store ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) return <Skeleton className="h-40" />;
  if (!store) return <p className="text-sm text-ink-muted">No store linked.</p>;

  const trialEnds = store.trial_ends_at ? new Date(store.trial_ends_at) : null;
  const trialActive = trialEnds ? trialEnds.getTime() > Date.now() : store.subscription_plan === "free";
  const plan = STORE_PLANS[(store.subscription_plan as keyof typeof STORE_PLANS) || "free"] || STORE_PLANS.free;

  return (
    <div className="space-y-6">
      <Panel title="FINDIT+ Business">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Current plan</dt>
            <dd className="mt-1 text-lg font-semibold">{plan.name}</dd>
            <dd className="text-ink-muted">{plan.tagline}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Status</dt>
            <dd className="mt-1 font-medium capitalize">{store.subscription_status || "active"}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Trial</dt>
            <dd className="mt-1">
              {trialActive && trialEnds
                ? `Ends ${trialEnds.toLocaleDateString()} (${STORE_TRIAL_DAYS}-day trial)`
                : trialEnds
                  ? "Trial ended"
                  : `${STORE_TRIAL_DAYS}-day trial on approval`}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">After trial</dt>
            <dd className="mt-1">
              ${STORE_PLANS.starter.priceMonthly}/month per location, every
              store feature — billing is not connected yet.
            </dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Payments">
        <p className="text-sm text-ink-muted">
          Payment method, invoices, and renewals will appear here when Stripe is wired. FINDIT
          will not show fake charges or card data.
        </p>
      </Panel>
    </div>
  );
}
