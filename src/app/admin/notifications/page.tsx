import { Panel } from "@/components/dashboard/shell";
import { AdminPushBroadcastForm } from "@/app/admin/notifications/broadcast-form";
import { getAdminPushPageDataAction } from "@/lib/admin/push-actions";
import { adminPushAudienceLabel } from "@findit/domain";
import { formatRelativeTime } from "@/lib/utils";

export default async function AdminNotificationsPage() {
  const { counts, recent, configured, demo } = await getAdminPushPageDataAction();

  return (
    <div className="space-y-6">
      <Panel title="Send a notification">
        <p className="-mt-2 mb-4 text-sm text-ink-muted">
          Reaches phones that already allowed alerts. Dead tokens are dropped
          automatically.
        </p>
        <AdminPushBroadcastForm
          counts={counts}
          configured={configured}
          demo={demo}
        />
      </Panel>
      <Panel title="Recent broadcasts">
        {recent.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing sent yet.</p>
        ) : (
          <ul className="divide-y divide-black/[0.06] text-sm">
            {recent.map((row) => (
              <li key={row.id} className="py-3">
                <p className="font-medium text-ink">{row.title}</p>
                <p className="mt-0.5 text-ink-muted">{row.body}</p>
                <p className="mt-1 text-xs text-ink-subtle">
                  {adminPushAudienceLabel(row.audience)} · {row.recipient_count}{" "}
                  device{row.recipient_count === 1 ? "" : "s"}
                  {row.pruned_count ? ` · ${row.pruned_count} pruned` : ""} ·{" "}
                  {formatRelativeTime(row.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
