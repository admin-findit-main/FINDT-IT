"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/primitives";
import { EmailSignIn } from "@/components/auth/email-sign-in";
import { marketingHomeHref } from "@/lib/config/product-hosts";

function BusinessLoginForm() {
  const params = useSearchParams();
  const next = params.get("next");

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        Sign in to your store
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Owners, staff, and the FINDIT operator can use a password or a one-time
        login emailed to this device.
      </p>
      <EmailSignIn next={next} emailId="store-signin-email" />
      <div className="mt-6 border-t border-hairline-strong pt-5 text-center text-sm text-ink-muted">
        <Link
          href={marketingHomeHref()}
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          Go back to askfindit.com
        </Link>
      </div>
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
