"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Card } from "@/components/ui/primitives";
import { destinationAfterAuth } from "@/lib/auth/home-path";
import { PhoneOtpForm } from "@/components/auth/phone-otp-form";
import { CustomerEmailLoginForm } from "@/components/auth/customer-email-form";
import { GlassNotice } from "@/components/ui/glass";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const error = params.get("error");
  const [mode, setMode] = useState<"email" | "phone">("email");

  function go(result: { homePath: string; needsName?: boolean }) {
    router.push(
      destinationAfterAuth({
        homePath: result.homePath,
        next,
        needsName: result.needsName,
      })
    );
    router.refresh();
  }

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Sign in</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Shoppers, stores, and the FINDIT operator can sign in here.
      </p>
      {error ? (
        <div className="mt-4">
          <GlassNotice tone="muted">
            {error === "auth_callback"
              ? "That email link is invalid or already used. Request a new one, or sign in."
              : error}
          </GlassNotice>
        </div>
      ) : null}
      {mode === "email" ? (
        <CustomerEmailLoginForm next={next} />
      ) : (
        <PhoneOtpForm createIfMissing={false} onFinished={go} />
      )}
      {mode === "email" ? (
        <p className="mt-4 text-center text-sm text-ink-muted">
          <Link
            href="/forgot-password"
            className="underline underline-offset-2 transition-colors hover:text-ink"
          >
            Forgot password?
          </Link>
        </p>
      ) : null}
      <button
        type="button"
        className="mt-4 w-full text-center text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        onClick={() => setMode(mode === "email" ? "phone" : "email")}
      >
        {mode === "email" ? "Use phone instead" : "Use email instead"}
      </button>
      <div className="mt-6 border-t border-hairline-strong pt-5">
        <p className="text-center text-sm text-ink-muted">
          No account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-ink underline-offset-2 hover:underline"
          >
            Create one
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-ink-muted">
          Store or staff?{" "}
          <Link href="/login/business" className="font-semibold text-ink">
            Business login
          </Link>
        </p>
      </div>
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
