import { redirect } from "next/navigation";
import { AdminEmpty, AdminPage, AdminPanel } from "@/components/admin/ui";
import { getAdminWaitlistAction } from "@/lib/admin/ops-actions";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getCurrentProfile } from "@/lib/services/actions";
import { formatRelativeTime } from "@/lib/utils";

export default async function AdminWaitlistPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const rows = await getAdminWaitlistAction();

  const shoppers = rows.filter((r) => r.audience === "shopper");
  const stores = rows.filter((r) => r.audience === "store");

  return (
    <AdminPage
      title="Waitlist"
      subtitle="Emails collected on askfindit.com before someone has an account."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminPanel title={`Shoppers · ${shoppers.length}`}>
          {shoppers.length === 0 ? (
            <AdminEmpty title="No shopper waitlist yet" />
          ) : (
            <ul className="divide-y divide-black/[0.06] text-sm">
              {shoppers.map((row) => (
                <li key={row.id} className="flex justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.email}</p>
                    {row.display_name ? (
                      <p className="text-xs text-ink-muted">{row.display_name}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-ink-subtle">
                    {formatRelativeTime(row.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
        <AdminPanel title={`Stores · ${stores.length}`}>
          {stores.length === 0 ? (
            <AdminEmpty title="No store waitlist yet" />
          ) : (
            <ul className="divide-y divide-black/[0.06] text-sm">
              {stores.map((row) => (
                <li key={row.id} className="flex justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.email}</p>
                    <p className="text-xs text-ink-muted">
                      {row.store_name || row.display_name || "Store interest"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-subtle">
                    {formatRelativeTime(row.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>
    </AdminPage>
  );
}
