import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatCents } from "@findit/domain";
import { MetricCard, Panel } from "@/components/dashboard/shell";
import { isSoloAdmin } from "@/lib/auth/admin";
import {
  getAdminStoreDetailAction,
  getCurrentProfile,
  getStoreMetricsAction,
} from "@/lib/services/actions";
import { HUB_DEVICE_ONLINE_MS } from "@/lib/hub/constants";
import { deviceIsOnline } from "@/lib/hub/format";
import { formatRelativeTime } from "@/lib/utils";
import { getAdminStoreUsageSnapshotAction } from "@/lib/visits/engine";
import { AdminStoreActions } from "./store-actions";

type Props = { params: Promise<{ id: string }> };

export default async function AdminStoreDetailPage({ params }: Props) {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const { id } = await params;
  const detail = await getAdminStoreDetailAction(id);
  if (!detail) notFound();

  const { store, team, devices } = detail;
  const [metrics, usage] = await Promise.all([
    getStoreMetricsAction(store.id),
    getAdminStoreUsageSnapshotAction(store.id),
  ]);
  if (!usage) notFound();
  const hubsOnline = devices.filter(
    (device) =>
      !device.revokedAt && deviceIsOnline(device.lastSeenAt, Date.now(), HUB_DEVICE_ONLINE_MS)
  ).length;
  const rate =
    metrics.requests_today > 0
      ? `${Math.round((metrics.answered_today / metrics.requests_today) * 1000) / 10}%`
      : "—";

  return (
    <div className="space-y-6">
      <Link href="/admin/stores" className="text-sm text-ink-muted hover:text-ink">
        ← Stores
      </Link>

      <Panel title={store.name}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Location</dt>
            <dd>
              {store.street_address}, {store.city}, {store.state} {store.postal_code}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Status</dt>
            <dd>{store.is_suspended ? "Suspended" : store.is_active ? "Active" : "Inactive"}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Plan</dt>
            <dd className="capitalize">
              {store.subscription_plan} · {store.subscription_status}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Trial ends</dt>
            <dd>
              {store.trial_ends_at
                ? new Date(store.trial_ends_at).toLocaleDateString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Payment</dt>
            <dd>{usage.trial ? "Trial — not charging" : "Collection disabled"}</dd>
          </div>
        </dl>
        <div className="mt-6">
          <AdminStoreActions storeId={store.id} suspended={store.is_suspended} />
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Requests received" value={metrics.total_received} hint="All-time" />
        <MetricCard label="Responses" value={metrics.total_answered} hint={`Today ${rate}`} />
        <MetricCard
          label="Avg response time"
          value={
            metrics.avg_response_minutes != null
              ? `${Math.round(metrics.avg_response_minutes)} min`
              : "—"
          }
        />
        <MetricCard
          label="Verified visits"
          value={usage.visits}
          hint={usage.quote.tier.name}
        />
        <MetricCard
          label="Estimated invoice"
          value={usage.quote.contactSales ? "Contact FINDIT" : usage.formatEstimated}
          hint={usage.trial ? `Trial ${usage.formatBilled}` : usage.formatBilled}
        />
        <MetricCard label="Store selections" value={usage.funnel.selected} />
        <MetricCard
          label="Employee pool"
          value={
            usage.poolEnabled ? formatCents(usage.poolCents) : "Off"
          }
          hint={usage.poolEnabled ? `${usage.poolPercent}% of eligible revenue` : undefined}
        />
        <MetricCard label="Rewards issued" value={usage.rewardPointsIssued} hint="Points this month" />
        <MetricCard label="Fraud flags" value={usage.fraudCount} />
        <MetricCard label="Billing disputes" value={usage.disputes.length} />
        <MetricCard
          label="Hubs"
          value={`${hubsOnline}/${devices.filter((d) => !d.revokedAt).length}`}
          hint="Online now"
        />
      </div>

      <Panel title={`Users · ${team.length}`}>
        {team.length === 0 ? (
          <p className="text-sm text-ink-muted">No staff on this store yet.</p>
        ) : (
          <ul className="divide-y divide-black/[0.06] text-sm">
            {team.map((member) => (
              <li key={member.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{member.name}</p>
                  <p className="truncate text-ink-muted">{member.contact}</p>
                </div>
                <p className="shrink-0 capitalize text-ink-subtle">
                  {member.role} · {member.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {devices.length ? (
        <Panel title={`Devices · ${devices.length}`}>
          <ul className="divide-y divide-black/[0.06] text-sm">
            {devices.map((device) => (
              <li key={device.id} className="flex justify-between gap-3 py-3">
                <span className="font-medium">{device.name}</span>
                <span className="text-ink-muted">
                  {device.revokedAt
                    ? "Removed"
                    : deviceIsOnline(device.lastSeenAt, Date.now(), HUB_DEVICE_ONLINE_MS)
                      ? "Online"
                      : device.lastSeenAt
                        ? `Last active ${formatRelativeTime(device.lastSeenAt)}`
                        : "Never seen"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {usage.statements.length ? (
        <Panel title="Usage statements">
          <ul className="divide-y divide-black/[0.06] text-sm">
            {usage.statements.map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-3">
                <div>
                  <p className="font-medium capitalize">{row.status}</p>
                  <p className="text-ink-muted">
                    {row.visit_count} verified visits
                    {row.trial ? " · trial" : ""}
                  </p>
                </div>
                <p className="tabular-nums">{formatCents(row.estimated_cents)}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {usage.disputes.length ? (
        <Panel title="Billing disputes">
          <ul className="divide-y divide-black/[0.06] text-sm">
            {usage.disputes.map((row) => (
              <li key={row.id} className="py-3">
                <p className="font-medium capitalize">{row.status}</p>
                <p className="text-ink-muted">{row.reason}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
