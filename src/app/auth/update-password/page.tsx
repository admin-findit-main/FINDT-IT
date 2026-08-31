"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";
import { BrandHomeLink } from "@/components/brand/logo";
import { isSoloAdminEmail } from "@findit/domain";
import { destinationAfterAuth, type AppHomePath } from "@/lib/auth/home-path";
import { getAppWorkspaceAction } from "@/lib/services/actions";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          window.location.replace("/login?error=auth_callback");
          return;
        }
        setReady(true);
      } catch {
        if (!cancelled) window.location.replace("/login?error=auth_callback");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setLoading(false);
        toast.error("Could not update that password. Request a new reset link.");
        return;
      }
      toast.success("Password updated");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (isSoloAdminEmail(user?.email)) {
        window.location.assign("/admin");
        return;
      }
      const workspace = await getAppWorkspaceAction();
      window.location.assign(
        destinationAfterAuth({
          homePath: (workspace?.homePath || "/home") as AppHomePath,
          email: user?.email,
        })
      );
    } catch (err) {
      setLoading(false);
      toast.error("Could not update that password. Try again.");
    }
  }

  return (
    <div className="app-canvas min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <BrandHomeLink href="/" className="mb-10 self-start" />
        <Card level="strong" sheen className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Choose a new password
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            You&apos;re signed in via the reset link. Set a new password to continue.
          </p>
          {ready ? (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Saving…" : "Update password"}
              </Button>
            </form>
          ) : (
            <p className="mt-6 text-sm text-ink-muted">Checking your reset link…</p>
          )}
        </Card>
      </div>
    </div>
  );
}
