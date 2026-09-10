"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_PUSH_AUDIENCES,
  ADMIN_PUSH_BODY_MAX,
  ADMIN_PUSH_TITLE_MAX,
  adminPushAudienceLabel,
  defaultAdminPushUrl,
  type AdminPushAudience,
} from "@findit/domain";
import { ConfirmActionButton } from "@/components/admin/confirm-action";
import { Input, Label, Textarea } from "@/components/ui/primitives";
import { GlassNotice, GlassSelect } from "@/components/ui/glass";
import { sendAdminPushBroadcastAction } from "@/lib/admin/push-actions";
import type { AdminPushAudienceCounts } from "@/lib/admin/push-actions";

export function AdminPushBroadcastForm({
  counts,
  configured,
  demo,
}: {
  counts: AdminPushAudienceCounts;
  configured: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [audience, setAudience] = useState<AdminPushAudience>("shoppers");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const tally = counts[audience];
  const fallbackUrl = useMemo(() => defaultAdminPushUrl(audience), [audience]);
  const canSend =
    !demo && configured && title.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="space-y-4">
      {demo ? (
        <GlassNotice>Demo mode does not send live notifications.</GlassNotice>
      ) : null}
      {!demo && !configured ? (
        <GlassNotice>
          Web push keys are missing, so broadcasts cannot go out yet.
        </GlassNotice>
      ) : null}
      <div>
        <Label htmlFor="admin-push-audience">Audience</Label>
        <GlassSelect
          id="admin-push-audience"
          value={audience}
          onChange={(event) => setAudience(event.target.value as AdminPushAudience)}
        >
          {ADMIN_PUSH_AUDIENCES.map((value) => {
            const stats = counts[value];
            return (
              <option key={value} value={value}>
                {adminPushAudienceLabel(value)}
                {stats.devices
                  ? ` · ${stats.devices} device${stats.devices === 1 ? "" : "s"}`
                  : " · no devices yet"}
              </option>
            );
          })}
        </GlassSelect>
        <p className="mt-1.5 text-xs text-ink-muted">
          {tally.devices
            ? `${tally.devices} device${tally.devices === 1 ? "" : "s"} across ${tally.people} ${
                tally.people === 1 ? "person" : "people"
              }`
            : "Nobody in this group has a registered device yet."}
        </p>
      </div>
      <div>
        <Label htmlFor="admin-push-title">Title</Label>
        <Input
          id="admin-push-title"
          value={title}
          maxLength={ADMIN_PUSH_TITLE_MAX}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Store hours tonight"
          required
        />
      </div>
      <div>
        <Label htmlFor="admin-push-body">Message</Label>
        <Textarea
          id="admin-push-body"
          value={body}
          maxLength={ADMIN_PUSH_BODY_MAX}
          onChange={(event) => setBody(event.target.value)}
          placeholder="We close at 8. Open again at 9 tomorrow."
          required
        />
      </div>
      <div>
        <Label htmlFor="admin-push-url">Opens this page</Label>
        <Input
          id="admin-push-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={fallbackUrl}
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          FINDIT paths only. Leave blank to open {fallbackUrl}.
        </p>
      </div>
      <ConfirmActionButton
        label="Send notification"
        confirmTitle={`Send to ${adminPushAudienceLabel(audience)}?`}
        confirmBody={`This push goes to ${tally.devices || 0} registered device${
          (tally.devices || 0) === 1 ? "" : "s"
        }. Title: “${title.trim() || "…"}”.`}
        confirmLabel="Send now"
        tone="danger"
        variant="default"
        size="default"
        disabled={!canSend}
        onConfirm={async () => {
          const result = await sendAdminPushBroadcastAction({
            audience,
            title,
            body,
            url,
          });
          if (result.error) return result;
          if (result.demo) return { error: "Demo mode — nothing was sent." };
          if (!result.sent) return { error: "No devices registered for that audience." };
          setTitle("");
          setBody("");
          setUrl("");
          router.refresh();
          return { ok: true as const };
        }}
      />
    </div>
  );
}
