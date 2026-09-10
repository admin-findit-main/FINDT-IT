import Link from "next/link";
import { redirect } from "next/navigation";
import { formatShortPlace } from "@findit/domain";
import { AdminEmpty, AdminPage } from "@/components/admin/ui";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminStatsAction, getCurrentProfile } from "@/lib/services/actions";

export default async function AdminStoresPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const stats = await getAdminStatsAction();
  if (!stats) redirect("/login/business");

  return (
    <AdminPage
      title="Stores"
      subtitle="Open a location for people, Hub devices, billing, and suspension controls."
    >
      {stats.stores.length === 0 ? (
        <AdminEmpty title="No stores yet" body="Approved applications show up here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.stores.map((store) => (
            <Link
              key={store.id}
              href={`/admin/stores/${store.id}`}
              className="rounded-2xl border border-hairline-strong bg-white p-5 transition hover:border-black/20 hover:shadow-sm"
            >
              <p className="text-lg font-semibold tracking-tight text-ink">{store.name}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {formatShortPlace({
                  city: store.city,
                  state: store.state,
                  postalCode: store.postal_code,
                })}
              </p>
              <p className="mt-3 text-xs capitalize text-ink-subtle">
                {store.is_suspended ? "Suspended" : store.is_active ? "Active" : "Inactive"}
                {" · "}
                {store.subscription_plan}
              </p>
            </Link>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
