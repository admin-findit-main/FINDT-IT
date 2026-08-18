import { redirect } from "next/navigation";
import { MetricCard, Panel } from "@/components/dashboard/shell";
import { isSoloAdmin } from "@/lib/auth/admin";
import { STORE_PLANS, STORE_TRIAL_DAYS } from "@/lib/config/constants";
import { getAdminStatsAction, getCurrentProfile } from "@/lib/services/actions";

export default async function AdminSubscriptionsPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/home");
  const stats = await getAdminStatsAction();
  if (!stats) redirect("/home");

  const now = Date.now();
  const trials = stats.stores.filter(
    (s) => s.trial_ends_at && new Date(s.trial_ends_at).getTime() > now
  );
  const paid = stats.stores.filter((s) => s.subscription_plan !== "free");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Locations on trial" value={trials.length} />
        <MetricCard
          label="Stores on a paid plan"
          value={paid.length}
          hint="Plan field only — billing is not connected"
        />
        <MetricCard label="Card charges" value="—" hint="Stripe is not connected" />
      </div>
      <Panel title="Trials">
        {trials.length === 0 ? (
          <p className="text-sm text-ink-muted">No active trials.</p>
        ) : (
          <ul className="divide-y divide-black/[0.06] text-sm">
            {trials.map((s) => (
              <li key={s.id} className="flex justify-between py-3">
                <span>{s.name}</span>
                <span className="text-ink-muted">
                  Ends {new Date(s.trial_ends_at!).toLocaleDateString()} · {s.subscription_plan}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Catalog">
        <p className="text-sm text-ink-muted">
          FINDIT+ Business is {STORE_TRIAL_DAYS} days free, then $
          {STORE_PLANS.starter.priceMonthly.toFixed(2)}/month per location. Payments, past-due,
          and invoices are not implemented — this page does not invent them.
        </p>
      </Panel>
    </div>
  );
}
