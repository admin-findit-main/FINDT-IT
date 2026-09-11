import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StoreStaffPage } from "@/components/store/store-staff-page";
import { Skeleton } from "@/components/ui/primitives";
import { getStoreWorkspaceAction } from "@/lib/services/actions";

export default async function ShiftsPage() {
  const workspace = await getStoreWorkspaceAction();
  if (!workspace?.canManageStore || !workspace.store?.id) {
    redirect("/store/hub");
  }

  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <StoreStaffPage storeId={workspace.store.id} />
    </Suspense>
  );
}
