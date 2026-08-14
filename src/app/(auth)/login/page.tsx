"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Card } from "@/components/ui/primitives";
import { isSafeNextPath } from "@/lib/auth/home-path";
import { signInAction } from "@/lib/services/actions";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);

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
    const next = params.get("next");
    const homePath =
      "homePath" in result && result.homePath ? result.homePath : "/home";
    router.push(isSafeNextPath(next) ? next : homePath);
    router.refresh();
  }

  return (
    <Card level="strong" sheen className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Same login for customers and store staff — we open the right app for
        your account.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
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
      <div className="mt-6 border-t border-hairline-strong pt-5">
        <p className="text-center text-sm text-ink-muted">
          No account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-accent-ink transition-colors hover:text-accent"
          >
            Sign up to ask stores
          </Link>
        </p>
        <p className="mt-3 text-center text-xs leading-relaxed text-ink-muted">
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
