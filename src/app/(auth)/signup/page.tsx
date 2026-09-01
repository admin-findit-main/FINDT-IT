"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Input, Label, Card } from "@/components/ui/primitives";
import { destinationAfterAuth, isSafeNextPath } from "@/lib/auth/home-path";
import {
  AuthAudienceSwitch,
  AuthSignupLinks,
} from "@/components/auth/auth-audience";
import { EmailOtpForm } from "@/components/auth/email-otp-form";
import { completeCustomerFirstNameAction } from "@/lib/services/phone-auth-actions";
import { useSurfaceHref } from "@/components/host/host-surface";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const joinHref = useSurfaceHref("www", "/join");
  const signupHref = useSurfaceHref("dashboard", "/signup");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    if (params.get("type") === "business") {
      router.replace("/join");
    }
  }, [params, router]);

  const next = params.get("next");
  const isStaffInvite = Boolean(next?.startsWith("/invite/"));
  const loginHref = isSafeNextPath(next)
    ? `/login?next=${encodeURIComponent(next)}`
    : "/login";

  if (isStaffInvite) {
    return (
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Create your staff account
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Use the email from your invite. We’ll send a 6-digit code. After that,
          this device stays signed in and you can join the store team.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              name="firstName"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              name="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <EmailOtpForm
          createIfMissing
          audience="shopper"
          emailInputId="staff-invite-email"
          continueLabel="Email me a code"
          sendDisabled={!firstName.trim()}
          sendBlockedMessage="Enter your first name first."
          onFinished={async ({ homePath }) => {
            const named = await completeCustomerFirstNameAction(
              firstName,
              lastName
            );
            if (named.error) toast.error(named.error);
            router.push(
              destinationAfterAuth({
                homePath,
                next,
                needsName: Boolean(named.error),
              })
            );
            router.refresh();
          }}
        />
        <p className="mt-5 text-center text-sm text-ink-muted">
          Already have FINDIT?{" "}
          <Link
            href={loginHref}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <AuthAudienceSwitch
        audience="shopper"
        next={next}
        shopperHref={signupHref}
        storeHref={joinHref}
      />
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink">
        Create a shopper account
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        We’ll email a 6-digit code. No password. After that, this device stays
        signed in. Stores apply from the Store tab.
      </p>
      <EmailOtpForm
        createIfMissing
        audience="shopper"
        continueLabel="Email me a code"
        onFinished={({ homePath, needsName }) => {
          router.push(destinationAfterAuth({ homePath, next, needsName }));
          router.refresh();
        }}
      />
      <AuthSignupLinks next={next} />
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
