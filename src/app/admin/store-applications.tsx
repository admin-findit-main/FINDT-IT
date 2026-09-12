"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmActionButton } from "@/components/admin/confirm-action";
import { AdminEmpty, AdminPage, AdminPanel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";
import { GlassBadge, GlassNotice } from "@/components/ui/glass";
import { reviewStoreApplicationAction } from "@/lib/services/actions";
import { STORE_TRIAL_DAYS } from "@/lib/config/constants";
import { formatEin } from "@findit/domain";
import type { StoreApplication } from "@/types/database";

export function AdminStoreApplications({
  applications,
}: {
  applications: StoreApplication[];
}) {
  const router = useRouter();
  const [infoFor, setInfoFor] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  async function review(
    id: string,
    decision: "approved" | "rejected" | "needs_info",
    extraNotes?: string
  ) {
    const result = await reviewStoreApplicationAction(id, decision, extraNotes);
    if (result.error) return result;
    setInfoFor(null);
    setNotes("");
    router.refresh();
    return result;
  }

  return (
    <AdminPage
      title="Applications"
      subtitle={`Approve real businesses for a ${STORE_TRIAL_DAYS}-day trial. Every decision asks for confirmation.`}
    >
      <AdminPanel title={`Join requests · ${applications.length}`}>
        <div className="space-y-3">
          {applications.length === 0 ? (
            <AdminEmpty title="No applications yet" />
          ) : (
            applications.map((app) => (
              <div
                key={app.id}
                className="rounded-xl border border-hairline-strong bg-[var(--solid-chrome)] p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{app.business_name}</p>
                    <p className="mt-0.5 text-ink-muted">
                      {app.legal_name || app.business_name}
                      {app.entity_type ? ` · ${app.entity_type}` : ""}
                    </p>
                    <p className="mt-0.5 text-ink-muted">
                      {app.business_type} · {app.city}, {app.state} {app.postal_code}
                    </p>
                    <p className="mt-1 text-ink-muted">
                      {app.owner_name} · {app.owner_email} · {app.phone}
                    </p>
                    {app.ein ? (
                      <p className="mt-1 font-medium tabular-nums text-ink">
                        EIN {formatEin(app.ein)}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-medium text-ink-muted">
                        EIN not collected yet · confirm during review
                      </p>
                    )}
                    <p className="mt-1 text-xs text-ink-muted">{app.street_address}</p>
                    {app.request_categories?.length ? (
                      <p className="mt-1 text-xs text-ink-muted">
                        Categories: {app.request_categories.join(", ")}
                      </p>
                    ) : null}
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
                    <ConfirmActionButton
                      label="Approve"
                      confirmTitle={`Approve ${app.business_name}?`}
                      confirmBody={`Starts a ${STORE_TRIAL_DAYS}-day trial, provisions the store, and unlocks the Business dashboard.`}
                      confirmLabel="Approve store"
                      tone="success"
                      variant="default"
                      onConfirm={() => review(app.id, "approved")}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setInfoFor(app.id)}
                    >
                      Request more info
                    </Button>
                    <ConfirmActionButton
                      label="Reject"
                      confirmTitle={`Reject ${app.business_name}?`}
                      confirmBody="They will not get dashboard access. You can still see this application in history."
                      confirmLabel="Reject"
                      tone="danger"
                      onConfirm={() => review(app.id, "rejected")}
                    />
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
                    <ConfirmActionButton
                      label="Send request"
                      confirmTitle="Ask for more information?"
                      confirmBody="They’ll see your note on the waiting screen until you approve or reject."
                      confirmLabel="Send note"
                      disabled={!notes.trim()}
                      onConfirm={async () => {
                        const result = await review(app.id, "needs_info", notes);
                        if (!result.error) {
                          toast.success("Asked for more information");
                        }
                        return result;
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </AdminPanel>
    </AdminPage>
  );
}
