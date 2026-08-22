"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassNotice } from "@/components/ui/glass";
import { Card, Input, Label } from "@/components/ui/primitives";
import { authEmailErrorMessage } from "@/lib/auth/email-error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !anon) {
      setLoading(false);
      toast.message("Couldn't reset password", {
        description: "Check that email auth is configured, then try again.",
      });
      return;
    }

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const redirectTo = "https://www.askfindit.com/auth/update-password";
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      setLoading(false);
      if (error) {
        toast.error(authEmailErrorMessage(error.message));
        return;
      }
      setSent(true);
      toast.success("Check your email for a reset link");
    } catch (err) {
      setLoading(false);
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    }
  }

  return (
    <Card level="strong" sheen className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Reset password</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Enter your account email and we&apos;ll send a reset link.
      </p>
      {sent ? (
        <div className="mt-6 space-y-4">
          <GlassNotice tone="muted">
            If an account exists for{" "}
            <strong className="font-semibold text-ink">{email}</strong>,
            you&apos;ll receive an email shortly. Open the link to choose a new
            password.
          </GlassNotice>
          <Button asChild className="w-full" variant="outline">
            <Link href="/login">Back to login</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
          <Button asChild className="w-full" variant="outline">
            <Link href="/login">Back to login</Link>
          </Button>
        </form>
      )}
    </Card>
  );
}
