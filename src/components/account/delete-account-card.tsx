"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";
import { SUPPORT_EMAIL } from "@/lib/auth/admin";
import { ACCOUNT_DELETION_CONFIRMATION } from "@findit/domain";
import { deleteAccountAction } from "@/lib/services/actions";

export function DeleteAccountCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Card level="subtle" className="space-y-3 p-5">
      <p className="text-sm font-semibold text-ink">Delete account</p>
      <p className="text-xs leading-relaxed text-ink-muted">
        This signs you out and deletes your FINDIT login, Finds, photos, and
        notification tokens. If you own a store, transfer or close it first.
        Type <span className="font-semibold text-ink">{ACCOUNT_DELETION_CONFIRMATION}</span>{" "}
        to confirm.
      </p>
      {open ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor="delete-account-confirm">Confirm</Label>
            <Input
              id="delete-account-confirm"
              value={confirmation}
              autoComplete="off"
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={ACCOUNT_DELETION_CONFIRMATION}
            />
          </div>
          <Button
            variant="softDanger"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const result = await deleteAccountAction(confirmation);
              setBusy(false);
              if ("error" in result && result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Your FINDIT account was deleted.");
              router.push("/");
              router.refresh();
            }}
          >
            {busy ? "Deleting…" : "Permanently delete account"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setConfirmation("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      )}
      <p className="text-xs leading-relaxed text-ink-muted">
        Need help instead? Email{" "}
        <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </Card>
  );
}
