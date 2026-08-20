import Link from "next/link";
import { MetricCard, Panel } from "@/components/dashboard/shell";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminStatsAction, getCurrentProfile } from "@/lib/services/actions";
import { redirect } from "next/navigation";

export default async function AdminOverviewPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const stats = await getAdminStatsAction();
  if (!stats) redirect("/login/business");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active stores" value={stats.activeStores} />
        <MetricCard label="Pending applications" value={stats.pendingApplications} />
        <MetricCard label="Customers" value={stats.activeCustomers} />
        <MetricCard label="Accounts" value={stats.totalUsers} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Stores"
          action={
            <Link href="/admin/stores" className="text-xs text-ink-muted hover:text-ink">
              View all
            </Link>
          }
        >
          {stats.stores.length === 0 ? (
            <p className="text-sm text-ink-muted">No stores yet.</p>
          ) : (
            <ul className="divide-y divide-black/[0.06] text-sm">
              {stats.stores.slice(0, 8).map((store) => (
                <li key={store.id}>
                  <Link
                    href={`/admin/stores/${store.id}`}
                    className="flex justify-between gap-3 py-2.5 hover:text-[#C81109]"
                  >
                    <span className="font-medium">{store.name}</span>
                    <span className="text-ink-muted">
                      {store.city}, {store.state}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title="Applications"
          action={
            <Link href="/admin/applications" className="text-xs text-ink-muted hover:text-ink">
              Review
            </Link>
          }
        >
          {stats.storeApplications.length === 0 ? (
            <p className="text-sm text-ink-muted">No applications yet.</p>
          ) : (
            <ul className="divide-y divide-black/[0.06] text-sm">
              {stats.storeApplications.slice(0, 8).map((app) => (
                <li key={app.id} className="flex justify-between gap-3 py-2.5">
                  <span className="font-medium">{app.business_name}</span>
                  <span className="capitalize text-ink-muted">{app.status.replaceAll("_", " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
