"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Card } from "@/components/ui/primitives";
import { loginEmailPassword } from "@/lib/auth/client-login";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { marketingHomeHref } from "@/lib/config/product-hosts";

function BusinessLoginForm() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const next = params.get("next");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await loginEmailPassword(
      String(fd.get("email")),
      String(fd.get("password")),
      next
    );
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        Sign in to your store
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Owners, staff, and the FINDIT operator use email and password.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Signing in…" : "Log in"}
        </Button>
      </form>
      <div className="mt-6 border-t border-hairline-strong pt-5">
        <p className="mb-3 text-sm font-semibold text-ink">Or use a magic link</p>
        <MagicLinkForm emailId="store-magic-email" />
      </div>
      <p className="mt-5 text-center text-sm text-ink-muted">
        <Link
          href="/forgot-password"
          className="underline underline-offset-2 transition-colors hover:text-ink"
        >
          Forgot password?
        </Link>
      </p>
      <div className="mt-6 border-t border-hairline-strong pt-5 text-center text-sm text-ink-muted">
        <Link href={marketingHomeHref()} className="font-semibold text-ink">
          Go back to askfindit.com
        </Link>
      </div>
    </Card>
  );
}

export default function BusinessLoginPage() {
  return (
    <Suspense>
      <BusinessLoginForm />
    </Suspense>
  );
}
