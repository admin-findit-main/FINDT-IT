"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/primitives";
import { EmailSignIn } from "@/components/auth/email-sign-in";
import { AuthAudienceSwitch, AuthPageLinks } from "@/components/auth/auth-audience";
import { GlassNotice } from "@/components/ui/glass";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next");
  const error = params.get("error");

  return (
    <Card className="p-6 sm:p-8">
      <AuthAudienceSwitch audience="shopper" next={next} />
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink">
        Shopper sign in
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Use your password, or email a one-time login. Stores use the Store tab.
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
      <EmailSignIn next={next} audience="shopper" />
      <AuthPageLinks audience="shopper" next={next} />
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
