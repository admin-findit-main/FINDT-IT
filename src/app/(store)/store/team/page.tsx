import Link from "next/link";
import { redirect } from "next/navigation";
import { StoreTeamPanel } from "@/components/store/store-team-panel";
import { getStoreWorkspaceAction } from "@/lib/services/actions";

export default async function StoreTeamPage() {
  const workspace = await getStoreWorkspaceAction();
  if (!workspace?.canManageStore || !workspace.store?.id) {
    redirect("/store/hub");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-hairline-strong bg-white px-4 py-4 sm:px-5">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">Team</span> is login access for the
          Business dashboard.{" "}
          <Link href="/store/shifts" className="font-semibold text-[#8E1F2D] underline-offset-2 hover:underline">
            Shifts
          </Link>{" "}
          is for counter staff who clock in on the FINDIT Hub with a PIN only.
        </p>
      </div>
      <StoreTeamPanel storeId={workspace.store.id} />
    </div>
  );
}
