"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { BrandLogo } from "@/components/brand/logo";
import { getCurrentProfile } from "@/lib/services/actions";
import { verifyHubCheckinAction } from "@/lib/visits/engine";

function CheckinBody() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("t") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Checking you in…");
  const [points, setPoints] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const profile = await getCurrentProfile();
      if (!profile) {
        const next = `/check-in?t=${encodeURIComponent(token)}`;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!token) {
        setStatus("error");
        setMessage("That check-in code is missing. Scan the Hub screen.");
        return;
      }
      const result = await verifyHubCheckinAction(token);
      if (cancelled) return;
      if ("error" in result) {
        setStatus("error");
        setMessage(result.error);
        return;
      }
      setStatus("ok");
      setPoints(result.points);
      setMessage(
        result.flagged
          ? `FINDIT recorded this visit at ${result.storeName} for review.`
          : `You're checked in at ${result.storeName}.`
      );
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <BrandLogo kind="mark" className="h-8 w-auto" />
      <Card className="mt-8 p-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {status === "ok" ? "Checked in" : "FINDIT Check-in"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{message}</p>
        {status === "ok" && points > 0 ? (
          <p className="mt-4 text-sm font-semibold text-ink">+{points} FINDIT Points</p>
        ) : null}
        <Button className="mt-6 w-full" onClick={() => router.replace("/home")}>
          Back to FINDIT
        </Button>
      </Card>
    </div>
  );
}

export default function CheckinPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center text-sm text-ink-muted">
          Opening check-in…
        </div>
      }
    >
      <CheckinBody />
    </Suspense>
  );
}
