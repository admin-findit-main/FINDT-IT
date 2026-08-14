"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

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
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated");
      router.push("/home");
      router.refresh();
    } catch (err) {
      setLoading(false);
      toast.error(err instanceof Error ? err.message : "Could not update password");
    }
  }

  return (
    <div className="app-canvas min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <Link
          href="/"
          className="mb-10 flex items-center gap-1.5 self-start text-2xl font-bold tracking-tight text-ink"
        >
          FINDIT
          <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
        </Link>
        <Card level="strong" sheen className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Choose a new password
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            You&apos;re signed in via the reset link. Set a new password to continue.
          </p>
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
        </Card>
      </div>
    </div>
  );
}
