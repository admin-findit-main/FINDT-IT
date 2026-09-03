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
    <div className="flex min-h-dvh flex-col bg-[#0B0B0C] px-6 py-6 text-white sm:px-10 sm:py-8">
      <BrandLogo kind="business" tone="dark" className="h-7 w-auto shrink-0" />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <div className="max-w-xl lg:flex-1">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">Clock in</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {storeName}
          </h1>
          <p className="mt-4 text-lg text-white/60 sm:text-xl">
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
        <div className="w-full max-w-sm shrink-0 lg:max-w-md">
          <div className="mb-6 flex justify-center gap-5">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={`h-4 w-4 rounded-full ${
                  digits.length > index ? "bg-white" : "bg-white/20"
                }`}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {KEYS.map((key, index) =>
              key === "" ? (
                <span key={`empty-${index}`} />
              ) : (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => press(key)}
                  className="min-h-16 rounded-2xl bg-white/10 text-2xl font-semibold disabled:opacity-50 sm:min-h-20 sm:text-3xl"
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
