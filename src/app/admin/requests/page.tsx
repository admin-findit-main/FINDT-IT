import { redirect } from "next/navigation";
import { Panel } from "@/components/dashboard/shell";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminRequestsAction } from "@/lib/admin/directory";
import { getCurrentProfile } from "@/lib/services/actions";

export default async function AdminRequestsPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const rows = await getAdminRequestsAction();
  return (
    <Panel title={`Finds · ${rows.length}`}>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No Finds yet.</p>
      ) : (
        <ul className="divide-y divide-black/[0.06] text-sm">
          {rows.map((row) => (
            <li key={row.id} className="py-3">
              <p className="font-medium">{row.product_name}</p>
              <p className="text-xs text-ink-muted">
                {row.city}, {row.state} · {row.status}
                {row.stores_targeted != null ? ` · ${row.stores_targeted} stores` : ""}
                {` · ${new Date(row.created_at).toLocaleString()}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
