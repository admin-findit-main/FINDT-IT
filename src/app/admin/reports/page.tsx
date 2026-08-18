import { redirect } from "next/navigation";
import { Panel } from "@/components/dashboard/shell";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminReportsAction, getCurrentProfile } from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";

export default async function AdminReportsPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/home");
  const reports = await getAdminReportsAction();

  return (
    <Panel title="Moderation">
      {reports.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No reports yet. This queue fills when customers or stores file them.
        </p>
      ) : (
        <ul className="divide-y divide-black/[0.06] text-sm">
          {reports.map((r: { id: string; reason: string; status: string; created_at: string }) => (
            <li key={r.id} className="flex justify-between py-3">
              <span>
                {r.reason} · {r.status}
              </span>
              <span className="text-ink-muted">{formatRelativeTime(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
