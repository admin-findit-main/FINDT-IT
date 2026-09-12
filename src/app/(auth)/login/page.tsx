"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { EmailOtpForm } from "@/components/auth/email-otp-form";
import { GlassNotice } from "@/components/ui/glass";
import { publicLoginError } from "@/lib/auth/login-error";
import { destinationAfterAuth } from "@/lib/auth/home-path";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const error = publicLoginError(params.get("error"));

  return (
    <AuthPageShell
      audience="shopper"
      intent="signin"
      next={next}
      title="Shopper sign in"
      description="We email a 6-digit code. This device stays signed in."
    >
      {error ? (
        <div className="mt-4">
          <GlassNotice tone="muted">{error}</GlassNotice>
        </div>
      ) : null}
      <EmailOtpForm
        createIfMissing={false}
        audience="shopper"
        continueLabel="Email me a code"
        onFinished={({ homePath, needsName }) => {
          router.push(destinationAfterAuth({ homePath, next, needsName }));
          router.refresh();
        }}
      />
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
