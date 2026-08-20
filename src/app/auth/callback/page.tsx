"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandHomeLink } from "@/components/brand/logo";
import { Card } from "@/components/ui/primitives";
import { completeEmailAuthLink } from "@/lib/auth/complete-email-link";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await completeEmailAuthLink();
      if (cancelled) return;
      if (result.error) {
        setMessage(result.error);
        router.replace(
          `/login?error=${encodeURIComponent(result.error)}`
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="app-canvas min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <BrandHomeLink href="/" className="mb-10 self-start" />
        <Card level="strong" sheen className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {message === "Signing you in…" ? "Opening FINDIT" : "Couldn’t finish"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{message}</p>
        </Card>
      </div>
    </div>
  );
}
