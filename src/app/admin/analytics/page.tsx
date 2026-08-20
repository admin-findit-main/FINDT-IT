import { redirect } from "next/navigation";
import { Panel } from "@/components/dashboard/shell";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminStatsAction, getCurrentProfile } from "@/lib/services/actions";

export default async function AdminAnalyticsPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const stats = await getAdminStatsAction();
  if (!stats) redirect("/login/business");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Network">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-ink-muted">Stores</dt>
            <dd className="text-lg font-semibold">{stats.activeStores}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Customers</dt>
            <dd className="text-lg font-semibold">{stats.activeCustomers}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Accounts</dt>
            <dd className="text-lg font-semibold">{stats.totalUsers}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Pending applications</dt>
            <dd className="text-lg font-semibold">{stats.pendingApplications}</dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Locations">
        {stats.stores.length === 0 ? (
          <p className="text-sm text-ink-muted">No stores yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {stats.stores.slice(0, 12).map((store) => (
              <li key={store.id} className="flex justify-between gap-3">
                <span>{store.name}</span>
                <span className="text-ink-muted">
                  {store.city}, {store.state}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
