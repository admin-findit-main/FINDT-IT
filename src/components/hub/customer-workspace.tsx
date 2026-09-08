"use client";

import { useEffect, useState } from "react";
import { Delete, UserRoundSearch } from "lucide-react";
import { formatUsNationalInput } from "@findit/domain";
import {
  confirmLookupPurchaseAction,
  lookupHubCustomerAction,
  type CustomerLookupResult,
} from "@/lib/services/loyalty";
import { productUrl } from "@/lib/config/product-hosts";

type FoundCustomer = Extract<CustomerLookupResult, { status: "found" }>;
type Stage = "home" | "keypad" | "found" | "confirm" | "success" | "not-found";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const PRIVATE_STATE_TIMEOUT_MS = 45_000;

export function HubCustomerWorkspace({
  onPurchaseConfirmed,
}: {
  onPurchaseConfirmed?: () => void;
}) {
  const [stage, setStage] = useState<Stage>("home");
  const [digits, setDigits] = useState("");
  const [customer, setCustomer] = useState<FoundCustomer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    pointsAwarded: number;
    pointsBalance: number;
  } | null>(null);
  const [operationId, setOperationId] = useState("");

  function reset() {
    setStage("home");
    setDigits("");
    setCustomer(null);
    setError(null);
    setSuccess(null);
    setOperationId("");
  }

  useEffect(() => {
    if (!["found", "confirm", "success"].includes(stage)) return;
    const timer = window.setTimeout(reset, PRIVATE_STATE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [stage]);

  function addDigit(digit: string) {
    if (busy || digits.length >= 10) return;
    setDigits((value) => `${value}${digit}`.slice(0, 10));
    setError(null);
  }

  async function search() {
    if (busy || digits.length !== 10) return;
    setBusy(true);
    setError(null);
    let result: CustomerLookupResult;
    try {
      result = await lookupHubCustomerAction(digits);
    } catch (lookupError) {
      console.error("[FINDIT Hub] customer lookup failed", lookupError);
      setBusy(false);
      setError("We couldn’t connect. Try again.");
      return;
    }
    setBusy(false);
    if (result.status === "error") {
      setError(result.error);
      return;
    }
    if (result.status === "not_found") {
      setCustomer(null);
      setStage("not-found");
      return;
    }
    setCustomer(result);
    setOperationId(crypto.randomUUID());
    setStage("found");
  }

  async function confirmPurchase() {
    if (busy || !customer) return;
    setBusy(true);
    setError(null);
    let result: Awaited<ReturnType<typeof confirmLookupPurchaseAction>>;
    try {
      result = await confirmLookupPurchaseAction({
        phone: digits,
        operationId: operationId || crypto.randomUUID(),
      });
    } catch (purchaseError) {
      console.error("[FINDIT Hub] purchase confirmation failed", purchaseError);
      setBusy(false);
      setError("We couldn’t connect. Try again.");
      return;
    }
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess({
      pointsAwarded: result.pointsAwarded,
      pointsBalance: result.pointsBalance,
    });
    setStage("success");
    onPurchaseConfirmed?.();
  }

  if (stage === "home") {
    return (
      <section className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-6 py-10 md:px-12">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#7A1D28]">
          Customers
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#171315] md:text-5xl">
          Customers
        </h1>
        <p className="mt-3 text-lg text-[#6D6669]">
          Find a customer using their phone number.
        </p>
        <button
          type="button"
          onClick={() => setStage("keypad")}
          className="mt-10 flex min-h-24 w-full max-w-xl items-center justify-center gap-4 rounded-2xl bg-[#8E1F2D] px-8 text-xl font-bold text-white transition-colors hover:bg-[#741824] active:bg-[#61131D]"
        >
          <UserRoundSearch className="h-7 w-7" />
          + FIND CUSTOMER
        </button>
      </section>
    );
  }

  if (stage === "success" && success) {
    return (
      <section className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-6 py-10 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-[#EAF6EF] text-3xl text-[#18784A]">
          ✓
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#171315]">
          Purchase confirmed
        </h1>
        <p className="mt-6 text-3xl font-bold text-[#8E1F2D]">
          +{success.pointsAwarded} points
        </p>
        <p className="mt-2 text-lg text-[#6D6669]">
          {success.pointsBalance} total points
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-10 min-h-14 w-full max-w-sm rounded-xl bg-[#171315] px-8 text-base font-bold text-white"
        >
          DONE
        </button>
      </section>
    );
  }

  if (stage === "found" && customer) {
    return (
      <section className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-6 py-10">
        <button
          type="button"
          onClick={reset}
          className="mb-6 min-h-12 self-start rounded-xl px-3 text-sm font-semibold text-[#6D6669]"
        >
          ← Cancel
        </button>
        <div className="rounded-2xl border border-[#DED9DB] bg-white p-7 md:p-9">
          <p className="break-words text-3xl font-bold tracking-tight text-[#171315]">
            {customer.displayName}
          </p>
          <p className="mt-3 text-base text-[#6D6669]">
            {customer.maskedEmail || "Email on file"}
          </p>
          <p className="mt-1 text-base text-[#6D6669]">{customer.maskedPhone}</p>
          <div className="mt-7 border-t border-[#E7E2E4] pt-7">
            <p className="text-3xl font-bold text-[#8E1F2D]">
              ★ {customer.pointsBalance} POINTS
            </p>
            {customer.memberSince ? (
              <p className="mt-2 text-sm text-[#81797C]">
                Customer since {new Date(customer.memberSince).toLocaleDateString()}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setStage("confirm")}
            className="mt-8 min-h-14 w-full rounded-xl bg-[#8E1F2D] px-6 text-base font-bold text-white"
          >
            CONTINUE
          </button>
        </div>
      </section>
    );
  }

  if (stage === "confirm" && customer) {
    return (
      <section className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-6 py-10">
        <div className="rounded-2xl border border-[#DED9DB] bg-white p-7 text-center md:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#81797C]">
            Confirm transaction
          </p>
          <h1 className="mt-3 break-words text-3xl font-bold tracking-tight text-[#171315]">
            Confirm purchase for {customer.displayName}?
          </h1>
          <p className="mt-3 text-base text-[#6D6669]">
            Points will be awarded to this customer account.
          </p>
          {error ? (
            <p className="mt-5 rounded-xl bg-[#FFF0F1] px-4 py-3 text-sm text-[#8E1F2D]">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirmPurchase()}
            className="mt-8 min-h-16 w-full rounded-xl bg-[#8E1F2D] px-6 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? "CONFIRMING…" : "CONFIRM PURCHASE"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStage("found")}
            className="mt-3 min-h-12 w-full rounded-xl text-sm font-semibold text-[#6D6669]"
          >
            Back
          </button>
        </div>
      </section>
    );
  }

  if (stage === "not-found") {
    return (
      <section className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-6 py-10 text-center">
        <div className="rounded-2xl border border-[#DED9DB] bg-white p-7 md:p-9">
          <h1 className="text-3xl font-bold tracking-tight text-[#171315]">
            Customer not found
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-[#6D6669]">
            This phone number isn&apos;t connected to a FINDIT account yet.
          </p>
          <a
            href={productUrl("dashboard", "/signup")}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-[#8E1F2D] px-6 text-base font-bold text-white"
          >
            CUSTOMER SIGN-UP
          </a>
          <button
            type="button"
            onClick={() => {
              setDigits("");
              setStage("keypad");
            }}
            className="mt-3 min-h-12 w-full rounded-xl text-sm font-semibold text-[#6D6669]"
          >
            Try another number
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#7A1D28]">
            Find Customer
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#171315]">
            Enter customer&apos;s phone number
          </h1>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            disabled={busy || digits.length === 0}
            onClick={() => {
              setDigits("");
              setError(null);
            }}
            className="min-h-12 rounded-xl px-3 text-sm font-semibold text-[#6D6669] disabled:opacity-35"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={reset}
            className="min-h-12 rounded-xl px-3 text-sm font-semibold text-[#6D6669]"
          >
            Cancel
          </button>
        </div>
      </div>

      <div
        aria-label="Customer phone number"
        className="mt-7 flex min-h-20 items-center justify-center rounded-2xl border border-[#CEC7CA] bg-white px-6 text-center text-3xl font-semibold tracking-[0.08em] text-[#171315]"
      >
        {digits ? formatUsNationalInput(digits) : "(___) ___-____"}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-[#FFF0F1] px-4 py-3 text-sm text-[#8E1F2D]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-3">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={busy}
            onClick={() => addDigit(digit)}
            className="min-h-16 rounded-xl border border-[#D8D1D4] bg-white text-2xl font-semibold text-[#171315] active:bg-[#EEE9EB]"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          disabled={busy || digits.length === 0}
          aria-label="Delete last digit"
          onClick={() => setDigits((value) => value.slice(0, -1))}
          className="grid min-h-16 place-items-center rounded-xl border border-[#D8D1D4] bg-white text-[#413B3E] disabled:opacity-35"
        >
          <Delete className="h-6 w-6" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => addDigit("0")}
          className="min-h-16 rounded-xl border border-[#D8D1D4] bg-white text-2xl font-semibold text-[#171315]"
        >
          0
        </button>
        <button
          type="button"
          disabled={busy || digits.length !== 10}
          onClick={() => void search()}
          className="min-h-16 rounded-xl bg-[#8E1F2D] px-3 text-sm font-bold text-white disabled:bg-[#C7BFC2]"
        >
          {busy ? "SEARCHING…" : "SEARCH"}
        </button>
      </div>
    </section>
  );
}
