"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Card } from "@/components/ui/primitives";
import { signInAction } from "@/lib/services/actions";
import { destinationAfterAuth } from "@/lib/auth/home-path";

function BusinessLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const next = params.get("next");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await signInAction(
      String(fd.get("email")),
      String(fd.get("password"))
    );
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const homePath =
      "homePath" in result && result.homePath ? result.homePath : "/store";
    router.push(
      destinationAfterAuth({
        homePath,
        next,
      })
    );
    router.refresh();
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        Sign in to your store
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Owners and staff use email and password.
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
      <p className="mt-5 text-center text-sm text-ink-muted">
        <Link
          href="/forgot-password"
          className="underline underline-offset-2 transition-colors hover:text-ink"
        >
          Forgot password?
        </Link>
      </p>
      <div className="mt-6 border-t border-hairline-strong pt-5 text-center text-sm text-ink-muted">
        <p>
          Looking for something nearby?{" "}
          <Link href="/login" className="font-semibold text-ink">
            Customer login
          </Link>
        </p>
        <p className="mt-3 text-xs leading-relaxed">
          Own a business?{" "}
          <Link href="/join" className="font-semibold text-ink">
            Apply as a store
          </Link>
          . Staff: use the invite link from your owner.
        </p>
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
