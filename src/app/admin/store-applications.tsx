"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/dashboard/shell";
import { Textarea } from "@/components/ui/primitives";
import { GlassBadge, GlassNotice } from "@/components/ui/glass";
import { reviewStoreApplicationAction } from "@/lib/services/actions";
import { STORE_TRIAL_DAYS } from "@/lib/config/constants";
import type { StoreApplication } from "@/types/database";

export function AdminStoreApplications({
  applications,
}: {
  applications: StoreApplication[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [infoFor, setInfoFor] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  function review(
    id: string,
    decision: "approved" | "rejected" | "needs_info",
    extraNotes?: string
  ) {
    startTransition(async () => {
      const result = await reviewStoreApplicationAction(id, decision, extraNotes);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        decision === "approved"
          ? `Approved — ${STORE_TRIAL_DAYS}-day trial started`
          : decision === "needs_info"
            ? "Asked for more information"
            : "Application rejected"
      );
      setInfoFor(null);
      setNotes("");
      router.refresh();
    });
  }

  return (
    <Panel title="Store join requests">
      <p className="-mt-2 mb-4 text-sm text-ink-muted">
        Approve legitimate businesses for a {STORE_TRIAL_DAYS}-day free trial.
      </p>
      <div className="space-y-3">
        {applications.length === 0 ? (
          <p className="text-sm text-ink-muted">No applications yet.</p>
        ) : (
          applications.map((app) => (
            <div
              key={app.id}
              className="rounded-lg border border-hairline-strong p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{app.business_name}</p>
                  <p className="mt-0.5 text-ink-muted">
                    {app.business_type} · {app.city}, {app.state} {app.postal_code}
                  </p>
                  <p className="mt-1 text-ink-muted">
                    {app.owner_name} · {app.owner_email} · {app.phone}
                  </p>
                  {app.request_categories?.length ? (
                    <p className="mt-1 text-xs text-ink-muted">
                      Categories: {app.request_categories.join(", ")}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-muted">
                    Customer ID:{" "}
                    {app.requires_customer_id
                      ? "Required at the store"
                      : "Not required"}
                  </p>
                </div>
                <GlassBadge
                  tone={
                    app.status === "pending"
                      ? "order"
                      : app.status === "approved"
                        ? "stock"
                        : app.status === "needs_info"
                          ? "accent"
                          : "oos"
                  }
                  className="text-xs font-bold capitalize"
                >
                  {app.status.replace("_", " ")}
                </GlassBadge>
              </div>
              <p className="mt-3 leading-relaxed text-ink-muted">{app.why_legit}</p>
              {app.admin_notes ? (
                <GlassNotice tone="accent" className="mt-3 text-xs">
                  Admin note: {app.admin_notes}
                </GlassNotice>
              ) : null}
              {app.status === "pending" || app.status === "needs_info" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => review(app.id, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setInfoFor(app.id)}
                  >
                    Request more info
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => review(app.id, "rejected")}
                  >
                    Reject
                  </Button>
                </div>
              ) : null}
              {infoFor === app.id ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What do you need from them?"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    disabled={pending || !notes.trim()}
                    onClick={() => review(app.id, "needs_info", notes)}
                  >
                    Send request
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
