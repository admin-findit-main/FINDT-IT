import Link from "next/link";
import { redirect } from "next/navigation";
import { formatShortPlace } from "@findit/domain";
import {
  AdminEmpty,
  AdminPage,
  AdminPanel,
  AdminQuickLink,
  AdminStat,
} from "@/components/admin/ui";
import { isSoloAdmin } from "@/lib/auth/admin";
import {
  getAdminActivityAction,
  getAdminStatsAction,
  getCurrentProfile,
  getPilotAdminStatsAction,
} from "@/lib/services/actions";
import { getAdminWaitlistAction } from "@/lib/admin/ops-actions";
import { formatDurationSeconds } from "@/lib/services/request-lifecycle";
import { formatRelativeTime } from "@/lib/utils";

export default async function AdminCommandPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");

  const [stats, pilot, activity, waitlist] = await Promise.all([
    getAdminStatsAction(),
    getPilotAdminStatsAction(),
    getAdminActivityAction(),
    getAdminWaitlistAction(),
  ]);
  if (!stats) redirect("/login/business");

  const pendingApps = stats.pendingApplications;
  const waitlistCount = waitlist.length;

  return (
    <AdminPage
      title="Command"
      subtitle="What needs attention across FINDIT right now."
      actions={
        <>
          <Link
            href="/admin/applications"
            className="inline-flex min-h-10 items-center rounded-full bg-[#E5231B] px-4 text-sm font-semibold text-white"
          >
            Review applications
          </Link>
          <Link
            href="/admin/notifications"
            className="inline-flex min-h-10 items-center rounded-full border border-hairline-strong px-4 text-sm font-semibold text-ink"
          >
            Broadcast
          </Link>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat
          label="Active stores"
          value={stats.activeStores}
          href="/admin/stores"
          hint={pilot ? `${pilot.storesRespondingToday} responding today` : undefined}
        />
        <AdminStat
          label="Pending joins"
          value={pendingApps}
          href="/admin/applications"
          tone={pendingApps > 0 ? "accent" : "default"}
          hint="Applications waiting on you"
        />
        <AdminStat
          label="Shoppers"
          value={stats.activeCustomers}
          href="/admin/shoppers"
          hint={pilot ? `${pilot.requestsToday} finds today` : undefined}
        />
        <AdminStat
          label="Waitlist"
          value={waitlistCount}
          href="/admin/waitlist"
          tone={waitlistCount > 0 ? "warn" : "default"}
          hint="Website signups"
        />
      </div>

      {pilot ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStat
            label="Response rate"
            value={`${pilot.responseRate}%`}
            href="/admin/analytics"
          />
          <AdminStat
            label="Successful finds"
            value={`${pilot.successfulFindRate}%`}
            href="/admin/analytics"
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
            label="Open asks"
            value={pilot.activeRequests}
            href="/admin/requests"
          />
        </div>
      ) : null}

      <AdminPanel title="Operate faster">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AdminQuickLink
            href="/admin/applications"
            label="Applications"
            body="Approve, request info, or reject join requests"
          />
          <AdminQuickLink
            href="/admin/reports"
            label="Moderation"
            body="Resolve or dismiss customer and store reports"
          />
          <AdminQuickLink
            href="/admin/subscriptions"
            label="Billing"
            body="Extend trials, complimentary access, suspend"
          />
          <AdminQuickLink
            href="/admin/hubs"
            label="Hubs"
            body="See paired tablets and revoke a device"
          />
          <AdminQuickLink
            href="/admin/waitlist"
            label="Waitlist"
            body="People who asked to be notified from the site"
          />
          <AdminQuickLink
            href="/admin/system"
            label="System"
            body="Live database probe and environment flags"
          />
        </div>
      </AdminPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminPanel
          title="Stores"
          action={
            <Link href="/admin/stores" className="text-xs font-medium text-ink-muted hover:text-ink">
              View all
            </Link>
          }
        >
          {stats.stores.length === 0 ? (
            <AdminEmpty title="No stores yet" />
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
                      {formatShortPlace({
                        city: store.city,
                        state: store.state,
                        postalCode: store.postal_code,
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>

        <AdminPanel
          title="Applications"
          action={
            <Link
              href="/admin/applications"
              className="text-xs font-medium text-ink-muted hover:text-ink"
            >
              Review
            </Link>
          }
        >
          {stats.storeApplications.length === 0 ? (
            <AdminEmpty title="No applications yet" />
          ) : (
            <ul className="divide-y divide-black/[0.06] text-sm">
              {stats.storeApplications.slice(0, 8).map((app) => (
                <li key={app.id} className="flex justify-between gap-3 py-2.5">
                  <span className="font-medium">{app.business_name}</span>
                  <span className="capitalize text-ink-muted">
                    {app.status.replaceAll("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>

      <AdminPanel title="Recent activity">
        {activity.length === 0 ? (
          <AdminEmpty title="No recent events" body="Analytics events will show here." />
        ) : (
          <ul className="divide-y divide-black/[0.06] text-sm">
            {activity.slice(0, 12).map(
              (row: {
                id: string;
                event_name: string;
                created_at: string;
                store_id?: string | null;
              }) => (
                <li key={row.id} className="flex justify-between gap-3 py-2.5">
                  <span className="font-medium">{row.event_name}</span>
                  <span className="shrink-0 text-ink-muted">
                    {formatRelativeTime(row.created_at)}
                  </span>
                </li>
              )
            )}
          </ul>
        )}
      </AdminPanel>
    </AdminPage>
  );
}
