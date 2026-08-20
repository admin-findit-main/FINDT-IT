import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4.0.1";
import {
  authEmailConfirmationUrl,
  authEmailCopy,
  renderFinditEmailHtml,
  renderFinditEmailText,
} from "./auth-email.ts";

const APP_URL = Deno.env.get("FINDIT_APP_URL") || "https://askfindit.com";
const FROM = Deno.env.get("RESEND_FROM") || "FINDIT <hello@askfindit.com>";

type HookPayload = {
  user: {
    email?: string;
    user_metadata?: {
      first_name?: string;
      display_name?: string;
    };
    new_email?: string;
  };
  email_data: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const hookSecretRaw = Deno.env.get("SEND_EMAIL_HOOK_SECRET") || "";
  if (!apiKey || !hookSecretRaw) {
    return jsonError(500, "Email sending is not configured.");
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const hookSecret = hookSecretRaw.replace("v1,whsec_", "");
  let event: HookPayload;
  try {
    event = new Webhook(hookSecret).verify(payload, headers) as HookPayload;
  } catch (error) {
    return jsonError(
      401,
      error instanceof Error ? error.message : "Invalid email hook signature"
    );
  }

  const to = event.user.email?.trim();
  if (!to) return jsonError(400, "Missing user email");

  const action = event.email_data.email_action_type || "signup";
  const firstName =
    event.user.user_metadata?.first_name ||
    event.user.user_metadata?.display_name ||
    "";
  const copy = authEmailCopy(action, {
    firstName,
    newEmail: event.user.new_email,
  });
  const buttonUrl =
    copy.button && event.email_data.token_hash
      ? authEmailConfirmationUrl({
          appUrl: APP_URL || event.email_data.site_url || "",
          tokenHash: event.email_data.token_hash,
          action,
        })
      : null;
  const code = action === "reauthentication" ? event.email_data.token : null;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: copy.subject,
    html: renderFinditEmailHtml({
      heading: copy.heading,
      body: copy.body,
      buttonLabel: copy.button,
      buttonUrl,
      footnote: copy.footnote,
      firstName,
      code,
    }),
    text: renderFinditEmailText({
      heading: copy.heading,
      body: copy.body,
      buttonUrl,
      footnote: copy.footnote,
      firstName,
      code,
    }),
  });

  if (error) {
    return jsonError(500, error.message);
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: { message, http_code: status } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
