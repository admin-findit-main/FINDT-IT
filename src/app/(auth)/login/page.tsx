"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/primitives";
import {
  AuthAudienceSwitch,
  AuthPageLinks,
} from "@/components/auth/auth-audience";
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
    <Card className="p-6 sm:p-8">
      <AuthAudienceSwitch audience="shopper" next={next} />
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink">
        Shopper sign in
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        We’ll email a 6-digit code. After that, this device stays signed in.
        Stores use the Store tab.
      </p>
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
