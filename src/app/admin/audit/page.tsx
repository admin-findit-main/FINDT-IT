import { redirect } from "next/navigation";
import { Panel } from "@/components/dashboard/shell";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminAuditAction } from "@/lib/admin/directory";
import { getCurrentProfile } from "@/lib/services/actions";

export default async function AdminAuditPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const rows = await getAdminAuditAction();
  return (
    <Panel title="Audit log">
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No security events yet.</p>
      ) : (
        <ul className="divide-y divide-black/[0.06] text-sm">
          {rows.map((row) => (
            <li key={row.id} className="py-3">
              <p className="font-medium">{row.action}</p>
              <p className="text-xs text-ink-muted">
                {new Date(row.created_at).toLocaleString()}
                {row.resource ? ` · ${row.resource}` : ""}
                {row.ip ? ` · ${row.ip}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
