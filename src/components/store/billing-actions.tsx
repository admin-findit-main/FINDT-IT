"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  cancelStoreSubscriptionAction,
  manageStoreBillingAction,
  startStoreCheckoutAction,
} from "@/lib/billing/actions";

export function StoreBillingActions({
  canManage,
  hasAccount,
  hasSubscription,
  testMode,
}: {
  canManage: boolean;
  hasAccount: boolean;
  hasSubscription: boolean;
  testMode: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return (
      <p className="text-sm text-ink-muted">
        Only the store owner can change billing.
      </p>
    );
  }

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
    if (result.url) {
      window.location.href = result.url;
      return;
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy !== null}
          onClick={() => run("start", startStoreCheckoutAction)}
        >
          {busy === "start"
            ? "Opening…"
              : hasSubscription
              ? "Update payment"
              : "Set up billing"}
        </Button>
        {hasAccount ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => run("manage", manageStoreBillingAction)}
          >
            {busy === "manage" ? "Opening…" : "Billing"}
          </Button>
        ) : null}
        {hasSubscription ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => {
              if (
                !window.confirm(
                  "Cancel FINDIT Business at the end of this billing period?"
                )
              ) {
                return;
              }
              void run("cancel", cancelStoreSubscriptionAction);
            }}
          >
            {busy === "cancel" ? "Canceling…" : "Cancel subscription"}
          </Button>
        ) : null}
      </div>
      {testMode ? (
        <p className="text-xs text-ink-muted">
          You’ll be notified before any paid subscription begins.
        </p>
      ) : null}
      {error ? <p className="text-sm text-accent-ink">{error}</p> : null}
    </div>
  );
}
