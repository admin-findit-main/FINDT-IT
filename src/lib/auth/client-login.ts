"use client";

import {
  isSoloAdminEmail,
  loginAudienceForAccount,
  wrongLoginSideMessage,
  type LoginAudience,
} from "@findit/domain";
import { createClient } from "@/lib/supabase/client";
import { destinationAfterAuth, type AppHomePath } from "@/lib/auth/home-path";
import { postAuthLocation } from "@/lib/config/product-hosts";
import {
  getAppWorkspaceAction,
  signInAction,
  signOutAction,
} from "@/lib/services/actions";

function go(href: string) {
  window.location.assign(postAuthLocation(href, window.location.host));
}

export type LoginEmailPasswordResult = {
  error?: string;
  code?: "wrong_side";
  requiredAudience?: LoginAudience;
};

async function closeWrongSideSession(
  belongs: LoginAudience
): Promise<LoginEmailPasswordResult> {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // Demo mode and missing keys never opened a browser session.
  }
  await signOutAction();
  return {
    error: wrongLoginSideMessage(belongs),
    code: "wrong_side",
    requiredAudience: belongs,
  };
}

function fromServerResult(
  server: Awaited<ReturnType<typeof signInAction>>
): LoginEmailPasswordResult {
  if (!server.error) return {};
  if ("code" in server && server.code === "wrong_side") {
    return {
      error: server.error,
      code: "wrong_side",
      requiredAudience: server.requiredAudience,
    };
  }
  return { error: server.error };
}

export async function loginEmailPassword(
  email: string,
  password: string,
  next?: string | null,
  audience?: LoginAudience
): Promise<LoginEmailPasswordResult> {
  const normalized = email.trim().toLowerCase();

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });
    if (error) {
      const server = await signInAction(normalized, password, audience);
      const failed = fromServerResult(server);
      if (failed.error) return failed;
      go(
        destinationAfterAuth({
          homePath:
            "homePath" in server && server.homePath
              ? (server.homePath as AppHomePath)
              : undefined,
          next,
          email: normalized,
        })
      );
      return {};
    }
  } catch (err) {
    const server = await signInAction(normalized, password, audience);
    const failed = fromServerResult(server);
    if (failed.error) {
      return {
        error:
          failed.error ||
          (err instanceof Error ? err.message : "Could not sign in"),
        code: failed.code,
        requiredAudience: failed.requiredAudience,
      };
    }
    go(
      destinationAfterAuth({
        homePath:
          "homePath" in server && server.homePath
            ? (server.homePath as AppHomePath)
            : undefined,
        next,
        email: normalized,
      })
    );
    return {};
  }

  if (isSoloAdminEmail(normalized) && audience && audience !== "store") {
    return closeWrongSideSession("store");
  }

  const workspace = await getAppWorkspaceAction();
  if (audience && workspace) {
    const belongs = loginAudienceForAccount({
      isAdmin: workspace.isAdmin || isSoloAdminEmail(normalized),
      accountType: workspace.accountType,
      hasActiveStoreMembership: workspace.hasStore,
    });
    if (belongs !== audience) {
      return closeWrongSideSession(belongs);
    }
  }

  if (isSoloAdminEmail(normalized)) {
    go("/admin");
    return {};
  }

  go(
    destinationAfterAuth({
      homePath: (workspace?.homePath || "/home") as AppHomePath,
      next,
      email: normalized,
    })
  );
  return {};
}
