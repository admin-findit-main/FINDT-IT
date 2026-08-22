"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/primitives";
import { CustomerEmailLoginForm } from "@/components/auth/customer-email-form";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { GlassNotice } from "@/components/ui/glass";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next");
  const error = params.get("error");

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Sign in</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Shoppers, stores, and the FINDIT operator can sign in here.
      </p>
      {error ? (
        <div className="mt-4">
          <GlassNotice tone="muted">
            {error === "auth_callback"
              ? "That email link is invalid or already used. Request a new one, or sign in."
              : error}
          </GlassNotice>
        </div>
      ) : null}
      <CustomerEmailLoginForm next={next} />
      <div className="mt-6 border-t border-hairline-strong pt-5">
        <p className="mb-3 text-sm font-semibold text-ink">Or use a magic link</p>
        <MagicLinkForm emailId="customer-magic-email" />
      </div>
      <p className="mt-4 text-center text-sm text-ink-muted">
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
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Create one
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-ink-muted">
          Store or staff?{" "}
          <Link href="/login/business" className="font-semibold text-ink">
            Business login
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
