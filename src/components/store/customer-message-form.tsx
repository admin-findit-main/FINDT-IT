"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmActionButton } from "@/components/admin/confirm-action";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/primitives";
import {
  getStoreMessageAudienceAction,
  sendStoreCustomerMessageAction,
} from "@/lib/services/store-customer-messages";

export function StoreCustomerMessageForm({
  initialCount,
  storeName,
}: {
  initialCount: number;
  storeName: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  const canSend = useMemo(
    () => title.trim().length >= 3 && body.trim().length >= 3 && !pending,
    [title, body, pending]
  );

  function refreshAudience() {
    startTransition(async () => {
      const result = await getStoreMessageAudienceAction();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setCount(result.count || 0);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-ink">Message your customers</p>
        <p className="mt-1 text-sm text-ink-muted">
          Sends an in-app / push alert to shoppers linked to{" "}
          <span className="font-medium text-ink">{storeName}</span> who have FINDIT
          alerts installed. Phone-only Hub rows and suspended accounts are
          skipped.
        </p>
        <p className="mt-2 text-xs text-ink-subtle">
          Reachable now:{" "}
          <span className="font-semibold tabular-nums text-ink">{count}</span>
          {" · "}
          <button
            type="button"
            className="font-semibold text-[#8E1F2D] underline-offset-2 hover:underline"
            onClick={refreshAudience}
          >
            Refresh count
          </button>
        </p>
      </div>
      <div>
        <Label htmlFor="store-msg-title">Title</Label>
        <Input
          id="store-msg-title"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Weekend points bonus"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="store-msg-body">Message</Label>
        <Textarea
          id="store-msg-body"
          value={body}
          maxLength={240}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Stop by this weekend — double points on purchases over $20."
          rows={4}
          className="mt-1.5"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <ConfirmActionButton
          label="Send to reachable customers"
          confirmTitle={`Send to ${count} customer${count === 1 ? "" : "s"}?`}
          confirmBody={`People linked to ${storeName} with FINDIT app or web alerts installed will get this. SMS texting is not included yet.`}
          confirmLabel="Send now"
          tone="danger"
          variant="default"
          size="default"
          disabled={!canSend || count === 0}
          onConfirm={async () => {
            const result = await sendStoreCustomerMessageAction({ title, body });
            if (result.error) return result;
            if ("demo" in result && result.demo) {
              return { ok: true as const, message: "Demo mode — nothing was sent." };
            }
            const sent = "sent" in result ? result.sent : 0;
            setTitle("");
            setBody("");
            router.refresh();
            return {
              ok: true as const,
              message: `Sent to ${sent} customer${sent === 1 ? "" : "s"}`,
            };
          }}
        />
        <Button type="button" variant="ghost" size="sm" onClick={refreshAudience}>
          Check audience
        </Button>
      </div>
    </div>
  );
}
