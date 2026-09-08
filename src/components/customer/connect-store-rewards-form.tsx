"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";
import { connectMyStoreRewardsAction } from "@/lib/services/loyalty";

function formatCodeInput(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12)
    .replace(/(.{4})(?=.)/g, "$1-");
}

export function ConnectStoreRewardsForm({
  defaultPhone = "",
}: {
  defaultPhone?: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Card className="mt-6 space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Connect store rewards</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          Enter the phone you gave the store and the recovery code from the
          store. The code—not your phone—proves these rewards are yours.
        </p>
      </div>
      <div>
        <Label htmlFor="rewards-store-phone">Store phone</Label>
        <Input
          id="rewards-store-phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="(571) 259-9714"
        />
      </div>
      <div>
        <Label htmlFor="rewards-recovery-code">12-character recovery code</Label>
        <Input
          id="rewards-recovery-code"
          value={code}
          onChange={(event) => setCode(formatCodeInput(event.target.value))}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          maxLength={14}
          placeholder="ABCD-2345-WXYZ"
          className="font-mono tracking-wider"
        />
      </div>
      <Button
        type="button"
        className="w-full"
        disabled={busy || !phone.trim() || code.replace(/-/g, "").length !== 12}
        onClick={async () => {
          setBusy(true);
          const result = await connectMyStoreRewardsAction({ phone, code });
          setBusy(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setCode("");
          toast.success(
            `${result.storeName} connected — ${result.pointsBalance} points`
          );
          router.refresh();
        }}
      >
        {busy ? "Connecting…" : "Connect store rewards"}
      </Button>
    </Card>
  );
}
