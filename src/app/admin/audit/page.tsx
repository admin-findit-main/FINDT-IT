import { redirect } from "next/navigation";
import { AdminEmpty, AdminPage, AdminPanel } from "@/components/admin/ui";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminAuditAction } from "@/lib/admin/directory";
import { getCurrentProfile } from "@/lib/services/actions";

export default async function AdminAuditPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const rows = await getAdminAuditAction();
  return (
    <AdminPage
      title="Audit"
      subtitle="Security-sensitive admin actions — suspends, report resolves, Hub revokes, pushes."
    >
      <AdminPanel title="Audit log">
        {rows.length === 0 ? (
          <AdminEmpty title="No security events yet" />
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
      </AdminPanel>
    </AdminPage>
  );
}
