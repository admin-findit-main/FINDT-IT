"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setStoreSuspendedAction } from "@/lib/services/actions";

export function AdminStoreActions({
  storeId,
  suspended,
}: {
  storeId: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!confirm(suspended ? "Reactivate this store?" : "Suspend this store?")) {
          return;
        }
        start(async () => {
          const result = await setStoreSuspendedAction(storeId, !suspended);
          if (result.error) toast.error(result.error);
          else {
            toast.success(suspended ? "Reactivated" : "Suspended");
            router.refresh();
          }
        });
      }}
    >
      {suspended ? "Reactivate" : "Suspend"}
    </Button>
  );
}
