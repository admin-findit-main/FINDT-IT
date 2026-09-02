"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ADMIN_PUSH_AUDIENCES,
  ADMIN_PUSH_BODY_MAX,
  ADMIN_PUSH_TITLE_MAX,
  adminPushAudienceLabel,
  defaultAdminPushUrl,
  type AdminPushAudience,
} from "@findit/domain";
import { Button } from "@/components/ui/button";
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
  const [pending, startTransition] = useTransition();
  const [audience, setAudience] = useState<AdminPushAudience>("shoppers");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const tally = counts[audience];
  const fallbackUrl = useMemo(() => defaultAdminPushUrl(audience), [audience]);

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await sendAdminPushBroadcastAction({
        audience,
        title,
        body,
        url,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.demo) {
        toast.message("Demo mode — nothing was sent.");
        return;
      }
      if (!result.sent) {
        toast.message("No devices registered for that audience.");
        return;
      }
      toast.success(
        result.pruned
          ? `Sent to ${result.sent} devices. Removed ${result.pruned} dead tokens.`
          : `Sent to ${result.sent} devices.`
      );
      setTitle("");
      setBody("");
      setUrl("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {demo ? (
        <GlassNotice>
          Demo mode does not send live notifications.
        </GlassNotice>
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
      <Button type="submit" disabled={pending || demo || !configured}>
        {pending ? "Sending…" : "Send notification"}
      </Button>
    </form>
  );
}
