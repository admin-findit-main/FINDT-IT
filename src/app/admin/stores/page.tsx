import Link from "next/link";
import { redirect } from "next/navigation";
import { isSoloAdmin } from "@/lib/auth/admin";
import { getAdminStatsAction, getCurrentProfile } from "@/lib/services/actions";

export default async function AdminStoresPage() {
  const profile = await getCurrentProfile();
  if (!isSoloAdmin(profile)) redirect("/login/business");
  const stats = await getAdminStatsAction();
  if (!stats) redirect("/login/business");

  if (stats.stores.length === 0) {
    return <p className="text-sm text-ink-muted">No stores yet.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {stats.stores.map((store) => (
        <Link
          key={store.id}
          href={`/admin/stores/${store.id}`}
          className="rounded-2xl border border-hairline-strong bg-white p-5 transition-colors hover:border-ink/20 hover:bg-black/[0.02]"
        >
          <p className="text-lg font-semibold tracking-tight text-ink">{store.name}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {store.city}, {store.state}
          </p>
          <p className="mt-3 text-xs capitalize text-ink-subtle">
            {store.is_suspended ? "Suspended" : store.is_active ? "Active" : "Inactive"}
            {" · "}
            {store.subscription_plan}
          </p>
        </Link>
      ))}
    </div>
  );
}
