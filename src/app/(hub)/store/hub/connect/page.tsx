"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { PairingQr } from "@/components/store/pairing-qr";
import { formatPairingCode } from "@/lib/hub/format";
import { hubRelinkMessage, parseHubRelinkReason } from "@/lib/hub/relink";
import {
  createHubPairingAction,
  getHubRuntimeAction,
  pollHubPairingAction,
} from "@/lib/services/hub-devices";

export default function HubConnectPage() {
  return (
    <Suspense>
      <HubConnectClient />
    </Suspense>
  );
}

function HubConnectClient() {
  const router = useRouter();
  const params = useSearchParams();
  const notice = hubRelinkMessage(parseHubRelinkReason(params.get("reason")));
  const [code, setCode] = useState<string | null>(null);
  const [pairUrl, setPairUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const start = useCallback(async () => {
    setError(null);
    const runtime = await getHubRuntimeAction();
    if (runtime?.source === "device") {
      router.replace("/store/hub");
      return;
    }
    const result = await createHubPairingAction();
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setCode(result.code);
    setPairUrl(result.pairUrl);
    setExpiresAt(result.expiresAt);
  }, [router]);

  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (!code) return;
    const id = window.setInterval(async () => {
      const result = await pollHubPairingAction();
      if ("status" in result && result.status === "paired") {
        router.replace("/store/hub");
      }
      if ("error" in result && result.error && !result.error.toLowerCase().includes("waiting")) {
        setError(result.error);
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [code, router]);

  const expired = Boolean(code && secondsLeft === 0);

  return (
    <div className="flex min-h-dvh flex-col bg-black px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center text-center">
        <BrandLogo kind="business" tone="dark" className="h-8" />
        <h1 className="mt-8 text-3xl font-bold tracking-tight md:text-4xl">
          Connect this device to FINDIT
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-white/65">
          Ask the store owner to enter this code under Devices.
        </p>

        {notice ? (
          <p className="mt-6 max-w-md rounded-2xl border border-[#E5231B]/40 bg-[#E5231B]/15 px-4 py-3 text-sm leading-relaxed text-white/90">
            {notice}
          </p>
        ) : null}

        {code ? (
          <>
            <p className="mt-10 font-mono text-6xl font-bold tracking-[0.2em] md:text-7xl">
              {formatPairingCode(code)}
            </p>
            <p className="mt-3 text-sm text-white/50">
              {expired
                ? "Code expired"
                : `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
            </p>
            {pairUrl ? (
              <div className="mt-8">
                <PairingQr value={pairUrl} label="Pairing QR code" />
                <p className="mt-3 text-xs text-white/45">
                  Owner scans this QR or types the code under Devices.
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-10 text-white/60">Preparing a pairing code…</p>
        )}

        {error ? <p className="mt-6 text-sm text-[#FF8078]">{error}</p> : null}

        <button
          type="button"
          onClick={() => void start()}
          className="mt-10 min-h-12 rounded-full bg-white/10 px-6 text-sm font-semibold text-white"
        >
          {expired ? "Generate a new code" : "Refresh code"}
        </button>
      </div>
    </div>
  );
}
