"use client";

import { useRef, useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { clockInHubAction } from "@/lib/services/shifts";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

export function HubClockGate({
  storeName,
  onClockedIn,
}: {
  storeName: string;
  onClockedIn: (name: string) => void;
}) {
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function submit(next: string) {
    if (next.length !== 4 || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    const result = await clockInHubAction(next);
    submitting.current = false;
    setBusy(false);
    if ("error" in result && result.error) {
      setError(result.error);
      setDigits("");
      return;
    }
    if ("name" in result) onClockedIn(result.name);
  }

  function press(key: (typeof KEYS)[number]) {
    if (busy || submitting.current) return;
    if (key === "") return;
    if (key === "del") {
      setDigits((current) => current.slice(0, -1));
      setError(null);
      return;
    }
    if (digits.length >= 4) return;
    const next = digits + key;
    setDigits(next);
    setError(null);
    void submit(next);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0B0B0C] text-white">
      <div className="shrink-0 px-8 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-12">
        <BrandLogo kind="business" tone="dark" className="h-7 w-auto" />
      </div>
      <div className="flex min-h-0 flex-1 items-center gap-10 px-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] pr-[max(2rem,env(safe-area-inset-right))] pl-[max(2rem,env(safe-area-inset-left))] md:gap-16 md:px-12">
        <div className="min-w-0 flex-1">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">Clock in</p>
          <h1 className="mt-3 text-[clamp(2rem,4.5vw,4.25rem)] font-bold leading-[1.05] tracking-tight">
            {storeName}
          </h1>
          <p className="mt-4 max-w-xl text-[clamp(1rem,1.6vw,1.35rem)] leading-relaxed text-white/60">
            Enter your 4-digit PIN to unlock FINDIT Hub. Your hours start when
            the PIN is accepted.
          </p>
          {error ? (
            <p className="mt-6 text-base text-[#E5231B]">{error}</p>
          ) : (
            <p className="mt-6 text-base text-white/40">
              {busy ? "Checking…" : "Ask the owner if you don’t have a PIN."}
            </p>
          )}
        </div>
        <div className="w-[min(42vw,24rem)] shrink-0">
          <div className="mb-5 flex justify-center gap-5">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={`h-4 w-4 rounded-full ${
                  digits.length > index ? "bg-white" : "bg-white/20"
                }`}
              />
            ))}
          </div>
          <div className="grid h-[min(28rem,calc(100dvh-10rem))] grid-cols-3 grid-rows-4 gap-3">
            {KEYS.map((key, index) =>
              key === "" ? (
                <span key={`empty-${index}`} />
              ) : (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => press(key)}
                  className="flex h-full w-full items-center justify-center rounded-2xl bg-white/10 text-[clamp(1.5rem,4vh,2.25rem)] font-semibold disabled:opacity-50"
                >
                  {key === "del" ? "⌫" : key}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
