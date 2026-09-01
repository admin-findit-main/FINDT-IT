"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { BrandHomeLink } from "@/components/brand/logo";
import { isSoloAdminEmail } from "@findit/domain";
import { destinationAfterAuth, type AppHomePath } from "@/lib/auth/home-path";
import { getAppWorkspaceAction } from "@/lib/services/actions";
import { useSurfaceHref } from "@/components/host/host-surface";
import Link from "next/link";

export default function UpdatePasswordPage() {
  const shopperLogin = useSurfaceHref("dashboard", "/login");
  const storeLogin = useSurfaceHref("store", "/login/business");
  const [status, setStatus] = useState<"checking" | "signed-in" | "signed-out">(
    "checking"
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setStatus("signed-out");
          return;
        }
        if (isSoloAdminEmail(user.email)) {
          window.location.assign("/admin");
          return;
        }
        const workspace = await getAppWorkspaceAction();
        window.location.assign(
          destinationAfterAuth({
            homePath: (workspace?.homePath || "/home") as AppHomePath,
            email: user.email,
          })
        );
        if (!cancelled) setStatus("signed-in");
      } catch {
        if (!cancelled) setStatus("signed-out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app-canvas min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <BrandHomeLink href="/" className="mb-10 self-start" />
        <Card level="strong" sheen className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Sign in with a code
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            FINDIT does not use passwords. If this link signed you in, we&apos;re
            sending you through. Otherwise request a 6-digit email code.
          </p>
          {status === "checking" ? (
            <p className="mt-6 text-sm text-ink-muted">Checking your link…</p>
          ) : (
            <div className="mt-6 space-y-3">
              <Button asChild className="w-full" size="lg">
                <Link href={shopperLogin}>Shopper sign in</Link>
              </Button>
              <Button asChild className="w-full" variant="outline" size="lg">
                <Link href={storeLogin}>Store sign in</Link>
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
