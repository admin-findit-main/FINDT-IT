"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Card } from "@/components/ui/primitives";
import { GlassNotice } from "@/components/ui/glass";
import { destinationAfterAuth, isSafeNextPath } from "@/lib/auth/home-path";
import { CustomerEmailSignupForm } from "@/components/auth/customer-email-form";
import {
  AuthMethodSwitch,
  EmailSignIn,
  OneTimeLoginPanel,
  type AuthMethod,
} from "@/components/auth/email-sign-in";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";
import { signUpAction } from "@/lib/services/actions";
import { marketingHomeHref } from "@/lib/config/product-hosts";
import { passwordStrength } from "@findit/domain";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);
  const [method, setMethod] = useState<AuthMethod>("password");
  const [email, setEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [noAccountHint, setNoAccountHint] = useState(false);

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

  async function onStaffSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await signUpAction({
      firstName: String(fd.get("firstName")),
      lastName: String(fd.get("lastName") || ""),
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      accountType: "customer",
      city: String(fd.get("city") || ""),
      state: String(fd.get("state") || "VA"),
      postalCode: String(fd.get("postalCode") || ""),
    });
    setLoading(false);
    if ("error" in result && result.error) {
      if ("code" in result && result.code === "existing_account") {
        setExistingAccount(true);
        return;
      }
      toast.error(result.error);
      return;
    }
    if ("needsEmailConfirm" in result && result.needsEmailConfirm) {
      toast.message("Open the email we just sent — tapping the link signs you in.");
      return;
    }
    toast.success("Account created");
    router.push(
      destinationAfterAuth({
        homePath: "homePath" in result && result.homePath ? result.homePath : "/home",
        next,
      })
    );
    router.refresh();
  }

  if (existingAccount) {
    return (
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          That email already has an account
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          FINDIT does not create a second login for the same email. Sign in with
          your password, or email a one-time login.
        </p>
        <EmailSignIn next={next} initialEmail={staffEmail || email} />
        <p className="mt-6 text-center text-sm text-ink-muted">
          <Link
            href={marketingHomeHref()}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Go back to askfindit.com
          </Link>
        </p>
      </Card>
    );
  }

  if (isStaffInvite) {
    return (
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Create your staff account
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Use the email from your invite. After signup you&apos;ll join the store
          team.
        </p>
        <form onSubmit={onStaffSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={staffPassword}
              onChange={(e) => setStaffPassword(e.target.value)}
            />
            <PasswordStrengthMeter password={staffPassword} email={staffEmail} />
          </div>
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading || !passwordStrength(staffPassword, staffEmail).ok}
          >
            {loading ? "Creating…" : "Create account & continue"}
          </Button>
        </form>
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
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {method === "onetime" ? "One-time login" : "Create account"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        {method === "onetime"
          ? "Already have FINDIT? We’ll email a link that signs you in once. New here? Switch to Password."
          : "New shopper? Create an account with a password. Already on FINDIT? Use a one-time login."}
      </p>
      <div className="mt-6 space-y-5">
        <AuthMethodSwitch
          value={method}
          onChange={(nextMethod) => {
            setMethod(nextMethod);
            setNoAccountHint(false);
          }}
        />
        {noAccountHint ? (
          <GlassNotice tone="muted">
            No FINDIT account for that email yet. Create one with a password.
          </GlassNotice>
        ) : null}
        {method === "onetime" ? (
          <OneTimeLoginPanel
            emailId="signup-onetime-email"
            email={email}
            onEmailChange={setEmail}
            autoFocus
            onNoAccount={() => {
              setMethod("password");
              setNoAccountHint(true);
            }}
            onUsePassword={() => setMethod("password")}
          />
        ) : (
          <CustomerEmailSignupForm
            email={email}
            onEmailChange={setEmail}
            onFinished={({ homePath, needsName }) => {
              router.push(destinationAfterAuth({ homePath, next, needsName }));
              router.refresh();
            }}
            onExistingAccount={() => setExistingAccount(true)}
          />
        )}
      </div>
      <div className="mt-6 border-t border-hairline-strong pt-5">
        <p className="text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link
            href={loginHref}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-ink-muted">
          <Link
            href={marketingHomeHref()}
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Go back to askfindit.com
          </Link>
        </p>
      </div>
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
