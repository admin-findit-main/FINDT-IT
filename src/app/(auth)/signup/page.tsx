"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Card } from "@/components/ui/primitives";
import { destinationAfterAuth, isSafeNextPath } from "@/lib/auth/home-path";
import { CustomerEmailSignupForm } from "@/components/auth/customer-email-form";
import { signUpAction } from "@/lib/services/actions";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (params.get("type") === "business") {
      router.replace("/join");
    }
  }, [params, router]);

  const next = params.get("next");
  const isStaffInvite = Boolean(next?.startsWith("/invite/"));

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

  if (isStaffInvite) {
    return (
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Create your staff account
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Use the email from your invite. After signup you’ll join the store team.
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
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Creating…" : "Create account & continue"}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Create account</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Customer accounts only. Stores apply separately.
      </p>
      <CustomerEmailSignupForm
        onFinished={({ homePath, needsName }) => {
          router.push(destinationAfterAuth({ homePath, next, needsName }));
          router.refresh();
        }}
      />
      <div className="mt-6 border-t border-hairline-strong pt-5">
        <p className="text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link
            href={
              isSafeNextPath(next)
                ? `/login?next=${encodeURIComponent(next)}`
                : "/login"
            }
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-ink-muted">
          Own a store?{" "}
          <Link href="/join" className="font-semibold text-ink">
            Apply as a store
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
