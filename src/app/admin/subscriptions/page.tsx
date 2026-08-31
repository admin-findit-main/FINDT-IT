import { redirect } from "next/navigation";
import { MetricCard, Panel } from "@/components/dashboard/shell";
import {
  AdminBillingSettingsForm,
  AdminStoreBillingActions,
} from "@/components/admin/billing-controls";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminBillingAction } from "@/lib/billing/actions";
import {
  BILLING_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/config/constants";
import { getCurrentProfile } from "@/lib/services/actions";

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export default async function AdminSubscriptionsPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const billing = await getAdminBillingAction();
  if (!billing) redirect("/login/business");

  const { rows, settings } = billing;
  const trials = rows.filter((row) => row.status === "trial").length;
  const processing = rows.filter((row) => row.status === "pending_payment").length;
  const active = rows.filter((row) => row.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Trials" value={trials} />
        <MetricCard
          label="Payment processing"
          hint="ACH is not instant — do not lock these stores"
          value={processing}
        />
        <MetricCard
          label="Active"
          hint={
            settings.billing_required
              ? "Store payment is required"
              : "Pilot — payment is not required"
          }
          value={active}
        />
      </div>

      <Panel title="Launch controls">
        <p className="mb-4 text-sm text-ink-muted">
          FastSpring {billing.configured ? "API credentials are present" : "is not connected yet"}.
          Secrets are never shown here. Do not enable live billing until the
          checklist is complete.
        </p>
        <AdminBillingSettingsForm
          billingRequired={settings.billing_required}
          shopperBillingRequired={settings.shopper_billing_required}
          allowPastDueAccess={settings.allow_past_due_access}
          allowFailedPaymentAccess={settings.allow_failed_payment_access}
          checklist={settings.launch_checklist || {}}
          liveApproved={settings.live_billing_approved}
          liveEnv={billing.liveEnv}
          checklistComplete={billing.checklistComplete}
        />
      </Panel>

      <Panel title="Stores">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">No stores yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Store</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  <th className="py-2 pr-3 font-medium">Plan</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Payment</th>
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 font-medium">Last / next</th>
                  <th className="py-2 font-medium">FastSpring</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {rows.map((row) => (
                  <tr key={row.storeId} className="align-top">
                    <td className="py-3 pr-3">
                      <p className="font-medium">{row.storeName}</p>
                      <p className="text-xs text-ink-muted">
                        {row.legalName || "—"}
                      </p>
                      <div className="mt-2">
                        <AdminStoreBillingActions storeId={row.storeId} />
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <p>{row.ownerName}</p>
                      <p className="text-xs text-ink-muted">{row.ownerEmail || "—"}</p>
                    </td>
                    <td className="py-3 pr-3 capitalize">{row.plan}</td>
                    <td className="py-3 pr-3">
                      {row.statusLabel}
                      {row.accessOverride !== "none" ? (
                        <p className="text-xs capitalize text-ink-muted">
                          {row.accessOverride}
                        </p>
                      ) : null}
                      {row.trialEndsAt ? (
                        <p className="text-xs text-ink-muted">
                          Trial {fmtDate(row.trialEndsAt)}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      {PAYMENT_STATUS_LABELS[
                        row.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS
                      ] || row.paymentStatus}
                    </td>
                    <td className="py-3 pr-3">
                      {BILLING_METHOD_LABELS[
                        row.billingMethod as keyof typeof BILLING_METHOD_LABELS
                      ] || row.billingMethod}
                    </td>
                    <td className="py-3 pr-3 text-xs text-ink-muted">
                      {fmtDate(row.lastPaymentAt)} / {fmtDate(row.nextPaymentAt)}
                    </td>
                    <td className="py-3 font-mono text-xs text-ink-muted">
                      <p>{row.fastspringAccountId || "—"}</p>
                      <p>{row.fastspringSubscriptionId || "—"}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
