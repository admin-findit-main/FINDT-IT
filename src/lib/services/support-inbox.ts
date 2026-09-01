import { SUPPORT_EMAIL, renderFinditEmailHtml, renderFinditEmailText } from "@findit/domain";
import { isDemoMode } from "@/lib/config/env";

export type SupportInboxKind =
  | "found"
  | "feedback"
  | "report";

export async function notifySupportInbox(input: {
  kind: SupportInboxKind;
  subject: string;
  heading: string;
  body: string;
  replyTo?: string | null;
}): Promise<void> {
  if (isDemoMode()) return;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const from = process.env.RESEND_FROM || "FINDIT <hello@askfindit.com>";
  const to =
    process.env.FINDIT_SUPPORT_INBOX?.trim() || SUPPORT_EMAIL;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        subject: input.subject,
        html: renderFinditEmailHtml({
          heading: input.heading,
          body: input.body,
          footnote: `FINDIT ${input.kind} · ${to}`,
        }),
        text: renderFinditEmailText({
          heading: input.heading,
          body: input.body,
          footnote: `FINDIT ${input.kind} · ${to}`,
        }),
      }),
    });
  } catch (error) {
    console.error("[FINDIT] support inbox email failed", error);
  }
}
