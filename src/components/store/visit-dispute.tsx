"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { disputeVerifiedVisitAction } from "@/lib/visits/engine";

export function VisitDisputeButton({ visitId }: { visitId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return <p className="text-xs text-ink-muted">Reported. We’ll review this visit.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs text-ink-muted underline-offset-2 hover:underline"
        onClick={() => setOpen(true)}
      >
        Report an issue with this visit
      </button>
    );
  }

  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        const result = await disputeVerifiedVisitAction({ visitId, reason });
        setBusy(false);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setDone(true);
      }}
    >
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="What is wrong with this visit?"
        className="w-full rounded-xl border border-hairline-strong bg-white px-3 py-2 text-sm"
      />
      {error ? <p className="text-xs text-[#C81109]">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          Submit
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
