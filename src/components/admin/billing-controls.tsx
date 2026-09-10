"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/admin/confirm-action";
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
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void save()}
          >
            Save checklist
          </Button>
          <ConfirmActionButton
            label={liveApproved ? "Live billing approved" : "Approve live billing"}
            confirmTitle="Approve live billing?"
            confirmBody="Only do this when FastSpring live mode is ready and every checklist item is confirmed. Charges can begin after this."
            confirmLabel="Approve live"
            tone="danger"
            variant="default"
            disabled={busy || liveApproved || !checklistComplete || !liveEnv}
            onConfirm={async () => {
              setBusy(true);
              setMessage(null);
              const result = await adminUpdateBillingSettingsAction({
                checklist: checks,
                approveLive: true,
              });
              setBusy(false);
              setMessage(result.error || "Saved.");
              return result;
            }}
          />
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
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    action: "extend_trial" | "complimentary" | "suspend" | "restore"
  ) {
    setMessage(null);
    const result = await adminStoreBillingAction({ storeId, action });
    if (result.error) {
      setMessage(result.error);
      return result;
    }
    setMessage("Updated.");
    return result;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <ConfirmActionButton
          label="Extend trial"
          confirmTitle="Extend this store’s trial?"
          confirmBody="Adds more complimentary trial time so the store stays open."
          confirmLabel="Extend trial"
          tone="success"
          onConfirm={() => run("extend_trial")}
        />
        <ConfirmActionButton
          label="Complimentary"
          confirmTitle="Grant complimentary access?"
          confirmBody="Marks this store as complimentary so billing will not block them."
          confirmLabel="Grant access"
          tone="success"
          onConfirm={() => run("complimentary")}
        />
        <ConfirmActionButton
          label="Suspend access"
          confirmTitle="Suspend billing access?"
          confirmBody="The store dashboard and Hub will pause until you restore access."
          confirmLabel="Suspend"
          tone="danger"
          onConfirm={() => run("suspend")}
        />
        <ConfirmActionButton
          label="Restore access"
          confirmTitle="Restore billing access?"
          confirmBody="The store can use FINDIT again immediately."
          confirmLabel="Restore"
          tone="success"
          onConfirm={() => run("restore")}
        />
      </div>
      {message ? <p className="text-xs text-ink-muted">{message}</p> : null}
    </div>
  );
}
