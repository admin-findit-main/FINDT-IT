import Link from "next/link";
import { redirect } from "next/navigation";
import { formatShortPlace } from "@findit/domain";
import {
  AdminEmpty,
  AdminPage,
  AdminPanel,
  AdminStat,
} from "@/components/admin/ui";
import { isSoloAdmin } from "@/lib/auth/admin";
import {
  getAdminActivityAction,
  getAdminStatsAction,
  getCurrentProfile,
  getPilotAdminStatsAction,
} from "@/lib/services/actions";
import { formatDurationSeconds } from "@/lib/services/request-lifecycle";
import { formatRelativeTime } from "@/lib/utils";

export default async function AdminAnalyticsPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");

  const [stats, pilot, activity] = await Promise.all([
    getAdminStatsAction(),
    getPilotAdminStatsAction(),
    getAdminActivityAction(),
  ]);
  if (!stats) redirect("/login/business");

  return (
    <AdminPage
      title="Analytics"
      subtitle="Pilot KPIs and recent platform activity — not a duplicate of Command."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat label="Active stores" value={stats.activeStores} href="/admin/stores" />
        <AdminStat label="Shoppers" value={stats.activeCustomers} href="/admin/shoppers" />
        <AdminStat label="Accounts" value={stats.totalUsers} />
        <AdminStat
          label="Pending joins"
          value={stats.pendingApplications}
          href="/admin/applications"
          tone={stats.pendingApplications > 0 ? "accent" : "default"}
        />
      </div>

      {pilot ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStat label="Finds today" value={pilot.requestsToday} />
            <AdminStat label="Open asks" value={pilot.activeRequests} href="/admin/requests" />
            <AdminStat label="Response rate" value={`${pilot.responseRate}%`} />
            <AdminStat
              label="Successful find rate"
              value={`${pilot.successfulFindRate}%`}
              tone="ok"
            />
            <AdminStat
              label="Avg first answer"
              value={
                pilot.avgFirstResponseSeconds != null
                  ? formatDurationSeconds(pilot.avgFirstResponseSeconds)
                  : "—"
              }
            />
            <AdminStat
              label="Median first answer"
              value={
                pilot.medianFirstResponseSeconds != null
                  ? formatDurationSeconds(pilot.medianFirstResponseSeconds)
                  : "—"
              }
            />
            <AdminStat label="Stores answering today" value={pilot.storesRespondingToday} />
            <AdminStat label="Completed asks" value={pilot.completedRequests} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <AdminPanel title="Top categories">
              {(pilot.topCategories || []).length === 0 ? (
                <AdminEmpty title="Not enough category data yet" />
              ) : (
                <ol className="space-y-2 text-sm">
                  {pilot.topCategories.slice(0, 8).map(
                    (row: { name: string; count: number }, index: number) => (
                      <li key={row.name} className="flex justify-between gap-3">
                        <span>
                          {index + 1}. {row.name}
                        </span>
                        <span className="tabular-nums text-ink-muted">{row.count}</span>
                      </li>
                    )
                  )}
                </ol>
              )}
            </AdminPanel>
            <AdminPanel title="Store response leaders">
              {(pilot.highestPerformingStores || []).length === 0 ? (
                <AdminEmpty title="No store performance yet" />
              ) : (
                <ul className="space-y-2 text-sm">
                  {pilot.highestPerformingStores.slice(0, 8).map((row) => (
                      <li key={row.id} className="flex justify-between gap-3">
                        <Link
                          href={`/admin/stores/${row.id}`}
                          className="font-medium hover:text-[#C81109]"
                        >
                          {row.name}
                        </Link>
                        <span className="text-ink-muted">
                          {row.responseRate}% · {row.finds} finds
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </AdminPanel>
          </div>
        </>
      ) : null}

      <AdminPanel title="Locations">
        {stats.stores.length === 0 ? (
          <AdminEmpty title="No stores yet" />
        ) : (
          <ul className="space-y-2 text-sm">
            {stats.stores.slice(0, 12).map((store) => (
              <li key={store.id} className="flex justify-between gap-3">
                <Link href={`/admin/stores/${store.id}`} className="hover:text-[#C81109]">
                  {store.name}
                </Link>
                <span className="text-ink-muted">
                  {formatShortPlace({
                    city: store.city,
                    state: store.state,
                    postalCode: store.postal_code,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>

      <AdminPanel title="Recent activity">
        {activity.length === 0 ? (
          <AdminEmpty title="No events yet" />
        ) : (
          <ul className="divide-y divide-black/[0.06] text-sm">
            {activity.slice(0, 20).map(
              (row: { id: string; event_name: string; created_at: string }) => (
                <li key={row.id} className="flex justify-between gap-3 py-2.5">
                  <span className="font-medium">{row.event_name}</span>
                  <span className="text-ink-muted">{formatRelativeTime(row.created_at)}</span>
                </li>
              )
            )}
          </ul>
        )}
      </AdminPanel>
    </AdminPage>
  );
}
