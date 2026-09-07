"use client";

import { useState } from "react";
import {
  formatUsNationalInput,
} from "@findit/domain";
import {
  confirmLookupPurchaseAction,
  lookupHubCustomerAction,
  type CustomerLookupResult,
} from "@/lib/services/loyalty";

type LookupState = Exclude<CustomerLookupResult, { status: "error" }> | null;

export function HubCustomerLookup({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<LookupState>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    pointsAwarded: number;
    pointsBalance: number;
    already: boolean;
  } | null>(null);
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());

  async function lookup() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setConfirmed(null);
    const found = await lookupHubCustomerAction(phone);
    setBusy(false);
    if (found.status === "error") {
      setResult(null);
      setError(found.error);
      return;
    }
    setResult(found);
    setOperationId(crypto.randomUUID());
  }

  async function confirm() {
    if (busy || result?.status !== "found") return;
    setBusy(true);
    setError(null);
    const purchase = await confirmLookupPurchaseAction({
      phone,
      operationId,
    });
    setBusy(false);
    if (!purchase.ok) {
      setError(purchase.error);
      return;
    }
    setConfirmed({
      pointsAwarded: purchase.pointsAwarded,
      pointsBalance: purchase.pointsBalance,
      already: purchase.alreadyConfirmed,
    });
    setOperationId(crypto.randomUUID());
    setResult({
      ...result,
      pointsBalance: purchase.pointsBalance,
      confirmedPurchases:
        result.confirmedPurchases + (purchase.alreadyConfirmed ? 0 : 1),
    });
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/80 p-4 md:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#141416] p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Customer lookup
            </p>
            <h2 className="mt-2 text-2xl font-bold">Find store rewards</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-3 text-sm font-semibold text-white/60"
          >
            Close
          </button>
        </div>

        <form
          className="mt-6 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void lookup();
          }}
        >
          <input
            type="tel"
            inputMode="tel"
            autoComplete="off"
            autoFocus
            value={phone}
            onChange={(event) => {
              const next = formatUsNationalInput(event.target.value);
              setPhone(next);
              setResult(null);
              setConfirmed(null);
              setError(null);
            }}
            placeholder="(571) 259-9714"
            className="min-h-14 min-w-0 flex-1 rounded-xl bg-black/50 px-4 text-xl outline-none ring-1 ring-white/15 focus:ring-white/40"
          />
          <button
            type="submit"
            disabled={busy || phone.replace(/\D/g, "").length < 10}
            className="min-h-14 rounded-xl bg-white px-5 font-bold text-black disabled:opacity-40"
          >
            {busy ? "Finding…" : "Find"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-xl border border-[#E5231B]/40 bg-[#E5231B]/15 px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        {result?.status === "not_found" ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="text-lg font-semibold">No verified customer found</p>
            <p className="mt-1 text-sm text-white/55">
              Check the number. The shopper must add and verify it in FINDIT
              before a store can find their account.
            </p>
          </div>
        ) : null}

        {result?.status === "found" ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-bold">{result.displayName}</p>
                <p className="mt-1 text-sm text-white/45">{result.maskedPhone}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums">
                  {result.pointsBalance}
                </p>
                <p className="text-xs uppercase tracking-wider text-white/45">
                  points here
                </p>
              </div>
            </div>

            {result.recentRequest ? (
              <div className="mt-4 border border-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-white/40">
                  Recent FINDIT request
                </p>
                <p className="mt-1 font-semibold">
                  {result.recentRequest.productName}
                </p>
              </div>
            ) : null}

            {confirmed ? (
              <div className="mt-4 rounded-xl bg-emerald-500/15 px-4 py-4 text-center">
                <p className="text-lg font-bold text-emerald-300">
                  {confirmed.already ? "Already confirmed" : "Purchase confirmed"}
                </p>
                <p className="mt-1 text-sm text-white/65">
                  {confirmed.pointsAwarded > 0
                    ? `+${confirmed.pointsAwarded} points · ${confirmed.pointsBalance} total`
                    : "No points awarded — the owner can enable rewards in Settings."}
                </p>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirm()}
                className="mt-5 min-h-16 w-full rounded-xl bg-[#0E9F6E] text-xl font-bold disabled:opacity-40"
              >
                {busy ? "Confirming…" : "CONFIRM PURCHASE"}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
