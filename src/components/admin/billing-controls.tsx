"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  adminStoreBillingAction,
  adminUpdateBillingSettingsAction,
} from "@/lib/billing/actions";
import { BILLING_LAUNCH_CHECKS } from "@findit/domain";

export function AdminBillingSettingsForm({
  billingRequired,
  shopperBillingRequired,
  allowPastDueAccess,
  allowFailedPaymentAccess,
  checklist,
  liveApproved,
  liveEnv,
  checklistComplete,
}: {
  billingRequired: boolean;
  shopperBillingRequired: boolean;
  allowPastDueAccess: boolean;
  allowFailedPaymentAccess: boolean;
  checklist: Record<string, boolean>;
  liveApproved: boolean;
  liveEnv: boolean;
  checklistComplete: boolean;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>(checklist);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(extra?: {
    billingRequired?: boolean;
    shopperBillingRequired?: boolean;
    allowPastDueAccess?: boolean;
    allowFailedPaymentAccess?: boolean;
    approveLive?: boolean;
  }) {
    setBusy(true);
    setMessage(null);
    const result = await adminUpdateBillingSettingsAction({
      checklist: checks,
      ...extra,
    });
    setBusy(false);
    setMessage(result.error || "Saved.");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            defaultChecked={billingRequired}
            onChange={(e) => void save({ billingRequired: e.target.checked })}
          />
          Require store payment (`billing_required`)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            defaultChecked={shopperBillingRequired}
            onChange={(e) =>
              void save({ shopperBillingRequired: e.target.checked })
            }
          />
          Require FINDIT+ shopper payment
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            defaultChecked={allowPastDueAccess}
            onChange={(e) => void save({ allowPastDueAccess: e.target.checked })}
          />
          Keep stores open while past due
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            defaultChecked={allowFailedPaymentAccess}
            onChange={(e) =>
              void save({ allowFailedPaymentAccess: e.target.checked })
            }
          />
          Keep stores open after a failed payment
        </label>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink">Launch checklist</p>
        <p className="mt-1 text-xs text-ink-muted">
          Live billing stays off until every item is confirmed and
          FASTSPRING_LIVE_MODE is enabled.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {BILLING_LAUNCH_CHECKS.map((item) => (
            <li key={item.id}>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checks[item.id] === true}
                  onChange={(e) =>
                    setChecks((prev) => ({ ...prev, [item.id]: e.target.checked }))
                  }
                />
                <span>{item.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void save()}>
            Save checklist
          </Button>
          <Button
            type="button"
            disabled={busy || liveApproved || !checklistComplete || !liveEnv}
            onClick={() => void save({ approveLive: true })}
          >
            {liveApproved ? "Live billing approved" : "Approve live billing"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          {liveEnv
            ? "FASTSPRING_LIVE_MODE is true in the environment."
            : "FASTSPRING_LIVE_MODE is false — checkouts stay in test mode."}
        </p>
      </div>
      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
    </div>
  );
}

export function AdminStoreBillingActions({ storeId }: { storeId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    action: "extend_trial" | "complimentary" | "suspend" | "restore"
  ) {
    setBusy(action);
    setMessage(null);
    const result = await adminStoreBillingAction({ storeId, action });
    setBusy(null);
    setMessage(result.error || "Updated.");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => void run("extend_trial")}
        >
          Extend trial
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => void run("complimentary")}
        >
          Complimentary
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => void run("suspend")}
        >
          Suspend access
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => void run("restore")}
        >
          Restore access
        </Button>
      </div>
      {message ? <p className="text-xs text-ink-muted">{message}</p> : null}
    </div>
  );
}
