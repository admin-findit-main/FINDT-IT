"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/primitives";
import { submitReportAction } from "@/lib/services/actions";
import { SUPPORT_EMAIL } from "@/lib/auth/admin";

export function SupportReportForm({
  requestId,
  storeId,
}: {
  requestId?: string;
  storeId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="text-sm font-semibold text-ink underline-offset-2 hover:underline"
        onClick={() => setOpen(true)}
      >
        Report a problem
      </button>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const result = await submitReportAction({
      reason: "App feedback",
      description: reason.trim(),
      requestId,
      storeId,
    });
    setSending(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Sent to FINDIT support");
    setReason("");
    setOpen(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Label htmlFor="support-report">What happened?</Label>
      <Textarea
        id="support-report"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        required
        rows={4}
        placeholder="Tell us what went wrong or what you liked."
      />
      <Button type="submit" size="lg" className="w-full" disabled={sending}>
        {sending ? "Sending…" : "Send to support"}
      </Button>
      <p className="text-xs text-ink-muted">
        Goes to {SUPPORT_EMAIL}. You can also email that address directly.
      </p>
    </form>
  );
}
