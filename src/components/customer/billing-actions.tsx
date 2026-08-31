"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCustomerBillingAction } from "@/lib/billing/actions";
import {
  cancelCustomerSubscriptionAction,
  manageCustomerBillingAction,
  startCustomerCheckoutAction,
} from "@/lib/billing/actions";

export function CustomerBillingActions({
  hasAccount,
  hasSubscription,
  testMode,
  configured,
}: {
  hasAccount: boolean;
  hasSubscription: boolean;
  testMode: boolean;
  configured: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    key: string,
    fn: () => Promise<{ url?: string; error?: string; ok?: boolean }>
  ) {
    setBusy(key);
    setError(null);
    const result = await fn();
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.url) window.location.href = result.url;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy !== null || !configured}
          onClick={() => run("start", startCustomerCheckoutAction)}
        >
          {busy === "start"
            ? "Opening…"
            : hasSubscription
              ? "Upgrade / change payment"
              : "Start FINDIT+"}
        </Button>
        {hasAccount ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => run("manage", manageCustomerBillingAction)}
          >
            Manage subscription
          </Button>
        ) : null}
        {hasSubscription ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => {
              if (!window.confirm("Cancel FINDIT+ at the end of this period?")) {
                return;
              }
              void run("cancel", cancelCustomerSubscriptionAction);
            }}
          >
            Cancel FINDIT+
          </Button>
        ) : null}
      </div>
      {!configured ? (
        <p className="text-xs text-ink-muted">
          FINDIT+ checkout is prepared but FastSpring is not connected yet. No
          shopper will be charged.
        </p>
      ) : testMode ? (
        <p className="text-xs text-ink-muted">
          Shopper checkout is test/sandbox only. Live FINDIT+ billing stays off
          until launch.
        </p>
      ) : null}
      {error ? <p className="text-sm text-accent-ink">{error}</p> : null}
    </div>
  );
}

export function CustomerPlanBilling() {
  const [billing, setBilling] = useState<Awaited<
    ReturnType<typeof getCustomerBillingAction>
  > | null>(null);

  useEffect(() => {
    getCustomerBillingAction().then(setBilling);
  }, []);

  if (!billing) return null;

  return (
    <div className="mt-6 space-y-2 rounded-2xl border border-hairline-strong bg-white p-5">
      <p className="text-sm font-semibold text-ink">FINDIT+ billing</p>
      <p className="text-sm text-ink-muted">
        {billing.priceLabel}. Status:{" "}
        {billing.subscription?.status || billing.profile.subscription_plan || "free"}.
      </p>
      <CustomerBillingActions
        hasAccount={Boolean(billing.subscription?.provider_customer_id)}
        hasSubscription={Boolean(billing.subscription?.provider_subscription_id)}
        testMode={billing.testMode}
        configured={billing.configured}
      />
    </div>
  );
}
