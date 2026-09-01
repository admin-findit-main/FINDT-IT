import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel } from "@/components/dashboard/shell";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminHubsAction, getCurrentProfile } from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";

export default async function AdminHubsPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const hubs = await getAdminHubsAction();
  if (!hubs) redirect("/login/business");

  if (hubs.length === 0) {
    return <p className="text-sm text-ink-muted">No Hub tablets paired yet.</p>;
  }

  return (
    <Panel title={`FINDIT Hubs · ${hubs.length}`}>
      <ul className="divide-y divide-black/[0.06] text-sm">
        {hubs.map((hub) => (
          <li key={hub.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium text-ink">{hub.name}</p>
              <Link
                href={`/admin/stores/${hub.storeId}`}
                className="truncate text-ink-muted hover:text-ink"
              >
                {hub.storeName}
              </Link>
            </div>
            <p className="shrink-0 text-ink-subtle">
              {hub.revokedAt
                ? "Disconnected"
                : hub.lastSeenAt
                  ? `Last active ${formatRelativeTime(hub.lastSeenAt)}`
                  : "Never seen"}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
