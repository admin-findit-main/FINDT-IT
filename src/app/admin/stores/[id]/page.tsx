import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Panel } from "@/components/dashboard/shell";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminStoreDetailAction, getCurrentProfile } from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";
import { AdminStoreActions } from "./store-actions";

type Props = { params: Promise<{ id: string }> };

export default async function AdminStoreDetailPage({ params }: Props) {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/home");
  const { id } = await params;
  const detail = await getAdminStoreDetailAction(id);
  if (!detail) notFound();

  const { store, team, devices } = detail;

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
        </dl>
        <div className="mt-6">
          <AdminStoreActions storeId={store.id} suspended={store.is_suspended} />
        </div>
      </Panel>

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
                    : device.lastSeenAt
                      ? `Last active ${formatRelativeTime(device.lastSeenAt)}`
                      : "Never seen"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
