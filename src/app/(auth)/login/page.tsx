"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/primitives";
import { EmailSignIn } from "@/components/auth/email-sign-in";
import { GlassNotice } from "@/components/ui/glass";
import { isSafeNextPath } from "@/lib/auth/home-path";
import { marketingHomeHref } from "@/lib/config/product-hosts";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next");
  const error = params.get("error");
  const signupHref = isSafeNextPath(next)
    ? `/signup?next=${encodeURIComponent(next)}`
    : "/signup";

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Sign in</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Shoppers, stores, and the FINDIT operator can sign in here. Use your
        password, or email a one-time login.
      </p>
      {error ? (
        <div className="mt-4">
          <GlassNotice tone="muted">
            {error === "auth_callback"
              ? "That email link is invalid or already used. Request a new one, or sign in with your password."
              : error}
          </GlassNotice>
        </div>
      ) : null}
      <EmailSignIn next={next} />
      <div className="mt-6 border-t border-hairline-strong pt-5 space-y-3">
        <p className="text-center text-sm text-ink-muted">
          New shopper?{" "}
          <Link
            href={signupHref}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Create an account
          </Link>
        </p>
        <p className="text-center text-sm text-ink-muted">
          <Link
            href={marketingHomeHref()}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Go back to askfindit.com
          </Link>
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
