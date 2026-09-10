import { AdminEmpty, AdminPage, AdminPanel } from "@/components/admin/ui";
import { AdminPushBroadcastForm } from "@/app/admin/notifications/broadcast-form";
import { getAdminPushPageDataAction } from "@/lib/admin/push-actions";
import { adminPushAudienceLabel } from "@findit/domain";
import { formatRelativeTime } from "@/lib/utils";

export default async function AdminNotificationsPage() {
  const { counts, recent, configured, demo } = await getAdminPushPageDataAction();

  return (
    <AdminPage
      title="Broadcast"
      subtitle="Confirm before every send. Reaches phones that already allowed alerts."
    >
      <AdminPanel title="Send a notification">
        <AdminPushBroadcastForm
          counts={counts}
          configured={configured}
          demo={demo}
        />
      </AdminPanel>
      <AdminPanel title="Recent broadcasts">
        {recent.length === 0 ? (
          <AdminEmpty title="Nothing sent yet" />
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
      </AdminPanel>
    </AdminPage>
  );
}
