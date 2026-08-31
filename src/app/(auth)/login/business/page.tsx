"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/primitives";
import { EmailSignIn } from "@/components/auth/email-sign-in";
import { AuthAudienceSwitch, AuthPageLinks } from "@/components/auth/auth-audience";
import { GlassNotice } from "@/components/ui/glass";
import { publicLoginError } from "@/lib/auth/login-error";

function BusinessLoginForm() {
  const params = useSearchParams();
  const next = params.get("next");
  const error = publicLoginError(params.get("error"));

  return (
    <Card className="p-6 sm:p-8">
      <AuthAudienceSwitch audience="store" next={next} />
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink">
        Store sign in
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Owners, staff, and the FINDIT operator. Wrong screen? Use Shopper sign
        in below.
      </p>
      {error ? (
        <div className="mt-4">
          <GlassNotice tone="muted">{error}</GlassNotice>
        </div>
      ) : null}
      <EmailSignIn next={next} emailId="store-signin-email" audience="store" />
      <AuthPageLinks audience="store" next={next} />
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
