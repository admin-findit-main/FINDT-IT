"use client";

import { isSoloAdminEmail } from "@findit/domain";
import { createClient } from "@/lib/supabase/client";
import { destinationAfterAuth, type AppHomePath } from "@/lib/auth/home-path";
import { getAppWorkspaceAction, signInAction } from "@/lib/services/actions";

function go(href: string) {
  window.location.assign(href);
}

export async function loginEmailPassword(
  email: string,
  password: string,
  next?: string | null
): Promise<{ error?: string }> {
  const normalized = email.trim().toLowerCase();

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });
    if (error) {
      const server = await signInAction(normalized, password);
      if (server.error) return { error: server.error };
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
    const server = await signInAction(normalized, password);
    if (server.error) {
      return {
        error:
          server.error ||
          (err instanceof Error ? err.message : "Could not sign in"),
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

  if (isSoloAdminEmail(normalized)) {
    go("/admin");
    return {};
  }

  const workspace = await getAppWorkspaceAction();
  go(
    destinationAfterAuth({
      homePath: (workspace?.homePath || "/home") as AppHomePath,
      next,
      email: normalized,
    })
  );
  return {};
}
