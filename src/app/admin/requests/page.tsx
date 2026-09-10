import { redirect } from "next/navigation";
import { AdminEmpty, AdminPage, AdminPanel } from "@/components/admin/ui";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminRequestsAction } from "@/lib/admin/directory";
import { getCurrentProfile } from "@/lib/services/actions";

export default async function AdminRequestsPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const rows = await getAdminRequestsAction();
  return (
    <AdminPage title="Finds" subtitle="Recent shopper asks across the network.">
      <AdminPanel title={`Finds · ${rows.length}`}>
        {rows.length === 0 ? (
          <AdminEmpty title="No Finds yet" />
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
      </AdminPanel>
    </AdminPage>
  );
}
