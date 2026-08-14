"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Card } from "@/components/ui/primitives";
import { isSafeNextPath } from "@/lib/auth/home-path";
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
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
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Account created");
    const next = params.get("next");
    router.push(isSafeNextPath(next) ? next : "/home");
    router.refresh();
  }

  const next = params.get("next");
  const isStaffInvite = Boolean(next?.startsWith("/invite/"));

  return (
    <Card level="strong" sheen className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {isStaffInvite ? "Create your staff account" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        {isStaffInvite
          ? "Use the email from your invite. After signup you’ll join the store team."
          : "Ask nearby stores if they have what you need."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" placeholder="Falls Church" />
          </div>
          <div>
            <Label htmlFor="postalCode">ZIP</Label>
            <Input id="postalCode" name="postalCode" placeholder="22044" />
          </div>
        </div>
        <input type="hidden" name="state" value="VA" />
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Creating…" : isStaffInvite ? "Create account & continue" : "Create account"}
        </Button>
      </form>
      <div className="mt-6 border-t border-hairline-strong pt-5">
        <p className="text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link
            href={
              isSafeNextPath(next)
                ? `/login?next=${encodeURIComponent(next)}`
                : "/login"
            }
            className="font-semibold text-accent-ink transition-colors hover:text-accent"
          >
            Log in
          </Link>
        </p>
        {!isStaffInvite ? (
          <p className="mt-3 text-center text-sm text-ink-muted">
            Own a store?{" "}
            <Link href="/join" className="font-semibold text-ink">
              Apply as a store
            </Link>
          </p>
        ) : null}
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
