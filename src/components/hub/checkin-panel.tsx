"use client";

import { useEffect, useState } from "react";
import { PairingQr } from "@/components/store/pairing-qr";
import { issueHubCheckinTokenAction } from "@/lib/visits/engine";
import { productOrigin } from "@/lib/config/product-hosts";

function checkinUrl(token: string) {
  const origin =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
      ? window.location.origin
      : productOrigin("dashboard");
  return `${origin}/check-in?t=${encodeURIComponent(token)}`;
}

export function HubCheckinPanel({ compact = false }: { compact?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function issue() {
      const result = await issueHubCheckinTokenAction();
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
        setUrl(null);
        timer = window.setTimeout(issue, 15_000);
        return;
      }
      setError(null);
      setUrl(checkinUrl(result.token));
      timer = window.setTimeout(issue, result.rotateMs || 45_000);
    }

    void issue();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (error && !url) {
    return compact ? null : (
      <p className="text-sm text-white/50">{error}</p>
    );
  }
  if (!url) {
    return (
      <div className="grid h-48 place-items-center text-sm text-white/40">
        Preparing check-in…
      </div>
    );
  }

  return (
    <div className={compact ? "flex items-center gap-4" : "text-center"}>
      {compact ? null : (
        <>
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">
            FINDIT Check-in
          </p>
          <p className="mt-2 text-xl font-semibold">Scan when you arrive</p>
        </>
      )}
      <div className={compact ? "w-28 shrink-0 sm:w-36" : "mt-6"}>
        <PairingQr
          value={url}
          label="FINDIT check-in"
          className={compact ? "w-full rounded-2xl bg-white p-2" : undefined}
        />
      </div>
      {compact ? (
        <p className="text-left text-sm text-white/60">
          Check-in
          <span className="mt-1 block text-white/40">Scan when you arrive</span>
        </p>
      ) : null}
    </div>
  );
}
