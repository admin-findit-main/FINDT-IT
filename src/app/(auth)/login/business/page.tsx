"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { EmailOtpForm } from "@/components/auth/email-otp-form";
import { GlassNotice } from "@/components/ui/glass";
import { publicLoginError } from "@/lib/auth/login-error";
import { destinationAfterAuth } from "@/lib/auth/home-path";
import { useSurfaceHref } from "@/components/host/host-surface";

function BusinessLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const error = publicLoginError(params.get("error"));
  const shopperLogin = useSurfaceHref("dashboard", "/login");

  return (
    <AuthPageShell
      audience="store"
      intent="signin"
      next={next}
      shopperHref={shopperLogin}
      title="Store sign in"
      description="Owners and staff. We email a 6-digit code. This device stays signed in."
    >
      {error ? (
        <div className="mt-4">
          <GlassNotice tone="muted">{error}</GlassNotice>
        </div>
      ) : null}
      <EmailOtpForm
        createIfMissing={false}
        audience="store"
        emailInputId="store-signin-email"
        continueLabel="Email me a code"
        onFinished={({ homePath, needsName }) => {
          router.push(destinationAfterAuth({ homePath, next, needsName }));
          router.refresh();
        }}
      />
    </AuthPageShell>
  );
}

export default function BusinessLoginPage() {
  return (
    <Suspense>
      <BusinessLoginForm />
    </Suspense>
  );
}
