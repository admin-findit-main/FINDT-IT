"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Card } from "@/components/ui/primitives";
import { EmailSignIn } from "@/components/auth/email-sign-in";
import { AuthAudienceSwitch, AuthPageLinks } from "@/components/auth/auth-audience";
import { PhoneOtpForm } from "@/components/auth/phone-otp-form";
import { GlassNotice } from "@/components/ui/glass";
import { publicLoginError } from "@/lib/auth/login-error";
import { destinationAfterAuth } from "@/lib/auth/home-path";
import { cn } from "@/lib/utils";

type StoreMethod = "email" | "phone";

function BusinessLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const error = publicLoginError(params.get("error"));
  const [method, setMethod] = useState<StoreMethod>("email");

  return (
    <Card className="p-6 sm:p-8">
      <AuthAudienceSwitch audience="store" next={next} />
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink">
        Store sign in
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Owners, staff, and the FINDIT operator. Use email and a password, or a
        text code. Wrong screen? Use Shopper sign in below.
      </p>
      {error ? (
        <div className="mt-4">
          <GlassNotice tone="muted">{error}</GlassNotice>
        </div>
      ) : null}
      <div
        role="tablist"
        aria-label="Email or phone"
        className="mt-6 grid grid-cols-2 gap-1 rounded-glass-lg bg-[var(--solid-3)] p-1"
      >
        {(
          [
            ["email", "Email"],
            ["phone", "Phone"],
          ] as const
        ).map(([id, label]) => {
          const selected = method === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMethod(id)}
              className={cn(
                "min-h-10 rounded-glass-md px-3 text-sm font-semibold transition-colors",
                selected
                  ? "bg-[var(--solid-1)] text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {method === "phone" ? (
        <PhoneOtpForm
          createIfMissing={false}
          audience="store"
          continueLabel="Text me a code"
          onFinished={({ homePath, needsName }) => {
            router.push(destinationAfterAuth({ homePath, next, needsName }));
            router.refresh();
          }}
        />
      ) : (
        <EmailSignIn next={next} emailId="store-signin-email" audience="store" />
      )}
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
