"use client";

import { EmailOtpForm } from "@/components/auth/email-otp-form";
import { writeShopperOnboardingState } from "@/lib/customer/onboarding-state";
import Link from "next/link";

export function AccountStep({
  loginHref,
  onFinished,
}: {
  loginHref: string;
  onFinished: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
          Get a code to your email
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">
          We&apos;ll email a 6-digit code. After that, this device stays signed
          in. No password.
        </p>
        <EmailOtpForm
          createIfMissing
          audience="shopper"
          continueLabel="Email me a code"
          onFinished={() => onFinished()}
        />
      </div>
      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link
          href={loginHref}
          onClick={() =>
            writeShopperOnboardingState({
              introSeen: true,
              installEducationSeen: true,
            })
          }
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          Already have an account
        </Link>
      </p>
    </div>
  );
}
