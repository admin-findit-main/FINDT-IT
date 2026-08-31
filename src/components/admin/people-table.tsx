"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { setProfileSuspendedAction } from "@/lib/admin/directory";
import type { AdminPersonRow } from "@/lib/admin/directory";

export function AdminPeopleTable({ rows }: { rows: AdminPersonRow[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(id: string, suspended: boolean) {
    setBusy(id);
    setMessage(null);
    const result = await setProfileSuspendedAction(id, !suspended);
    setBusy(null);
    setMessage(result.error || (suspended ? "Restored." : "Suspended."));
  }

  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">None yet.</p>;
  }

  return (
    <div className="space-y-3">
      {message ? <p className="text-sm text-ink-muted">{message}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Email</th>
              <th className="py-2 pr-3 font-medium">Plan</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="py-3 pr-3">
                  <p className="font-medium">{row.name}</p>
                  {row.storeName ? (
                    <p className="text-xs text-ink-muted">{row.storeName}</p>
                  ) : null}
                </td>
                <td className="py-3 pr-3 text-ink-muted">{row.email || "—"}</td>
                <td className="py-3 pr-3 capitalize">{row.plan}</td>
                <td className="py-3 pr-3">
                  {row.suspended ? "Suspended" : "Active"}
                </td>
                <td className="py-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy === row.id}
                    onClick={() => void toggle(row.id, row.suspended)}
                  >
                    {row.suspended ? "Restore" : "Suspend"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
