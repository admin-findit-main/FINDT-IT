"use client";

import { useRouter } from "next/navigation";
import { ConfirmActionButton } from "@/components/admin/confirm-action";
import { setStoreSuspendedAction } from "@/lib/services/actions";

export function AdminStoreActions({
  storeId,
  suspended,
}: {
  storeId: string;
  suspended: boolean;
}) {
  const router = useRouter();

  return (
    <ConfirmActionButton
      label={suspended ? "Reactivate" : "Suspend"}
      confirmTitle={suspended ? "Reactivate this store?" : "Suspend this store?"}
      confirmBody={
        suspended
          ? "The store can answer asks and use FINDIT Hub again."
          : "The store will be blocked from the dashboard and Hub until you reactivate."
      }
      confirmLabel={suspended ? "Reactivate" : "Suspend store"}
      tone={suspended ? "success" : "danger"}
      onConfirm={async () => {
        const result = await setStoreSuspendedAction(storeId, !suspended);
        if (!result.error) router.refresh();
        return result;
      }}
    />
  );
}
