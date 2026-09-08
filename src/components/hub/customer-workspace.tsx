"use client";

import { useEffect, useState } from "react";
import { Delete, UserRoundSearch } from "lucide-react";
import { formatUsNationalInput } from "@findit/domain";
import {
  estimateHubPoints,
  formatHubAmount,
  MAX_HUB_AMOUNT_CENTS,
} from "@/lib/hub/amount";
import {
  confirmPendingPurchaseAction,
  confirmLookupPurchaseAction,
  createPendingStoreCustomerAction,
  lookupHubCustomerAction,
  type CustomerLookupResult,
} from "@/lib/services/loyalty";

type FoundCustomer = Extract<
  CustomerLookupResult,
  { status: "found" | "pending" }
>;
type Stage =
  | "home"
  | "keypad"
  | "found"
  | "amount"
  | "confirm"
  | "success"
  | "not-found";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const PRIVATE_STATE_TIMEOUT_MS = 45_000;

export function HubCustomerWorkspace({
  onPurchaseConfirmed,
}: {
  onPurchaseConfirmed?: () => void;
}) {
  const [stage, setStage] = useState<Stage>("home");
  const [digits, setDigits] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [customer, setCustomer] = useState<FoundCustomer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    amountCents: number;
    pointsAwarded: number;
    pointsBalance: number;
  } | null>(null);
  const [operationId, setOperationId] = useState("");
  const [pendingCreateOperationId, setPendingCreateOperationId] = useState("");

  function reset() {
    setStage("home");
    setDigits("");
    setAmountCents(0);
    setCustomer(null);
    setError(null);
    setSuccess(null);
    setOperationId("");
    setPendingCreateOperationId("");
  }

  useEffect(() => {
    if (
      !["keypad", "found", "amount", "confirm", "success", "not-found"].includes(
        stage
      )
    ) {
      return;
    }
    const timer = window.setTimeout(reset, PRIVATE_STATE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [stage, digits, amountCents]);

  function addDigit(digit: string) {
    if (busy || digits.length >= 10) return;
    setDigits((value) => `${value}${digit}`.slice(0, 10));
    setError(null);
  }

  function addAmountDigit(digit: string) {
    if (busy) return;
    setAmountCents((value) =>
      Math.min(MAX_HUB_AMOUNT_CENTS, value * 10 + Number(digit))
    );
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

  async function createPendingCustomer() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const createOperationId =
      pendingCreateOperationId || crypto.randomUUID();
    setPendingCreateOperationId(createOperationId);
    try {
      const result = await createPendingStoreCustomerAction({
        phone: digits,
        operationId: createOperationId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCustomer(result.customer);
      setOperationId(crypto.randomUUID());
      setPendingCreateOperationId("");
      setStage("found");
    } catch (createError) {
      console.error("[FINDIT Hub] pending rewards creation failed", createError);
      setError("We couldn’t connect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPurchase() {
    if (busy || !customer) return;
    setBusy(true);
    setError(null);
    let result:
      | Awaited<ReturnType<typeof confirmLookupPurchaseAction>>
      | Awaited<ReturnType<typeof confirmPendingPurchaseAction>>;
    try {
      const input = {
        phone: digits,
        operationId: operationId || crypto.randomUUID(),
        amountCents,
      };
      result =
        customer.status === "pending"
          ? await confirmPendingPurchaseAction(input)
          : await confirmLookupPurchaseAction(input);
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
      amountCents,
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
      <section className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-6 py-4 text-center md:py-10">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-[#EAF6EF] text-2xl text-[#18784A] md:h-16 md:w-16 md:text-3xl">
          ✓
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#171315] md:mt-6 md:text-4xl">
          Purchase confirmed
        </h1>
        <p className="mt-2 text-xl font-semibold tabular-nums text-[#171315] md:mt-4 md:text-2xl">
          {formatHubAmount(success.amountCents)}
        </p>
        <p className="mt-4 text-2xl font-bold text-[#8E1F2D] md:mt-6 md:text-3xl">
          +{success.pointsAwarded} points
        </p>
        <p className="mt-1 text-base text-[#6D6669] md:mt-2 md:text-lg">
          {success.pointsBalance} total points
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 min-h-12 w-full max-w-sm rounded-xl bg-[#171315] px-8 text-base font-bold text-white md:mt-10 md:min-h-14"
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
          {customer.status === "found" ? (
            <p className="mt-3 text-base text-[#6D6669]">
              {customer.maskedEmail || "Email on file"}
            </p>
          ) : (
            <p className="mt-3 text-base font-semibold text-[#8E1F2D]">
              Rewards for this store only · Not a verified FINDIT account
            </p>
          )}
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
            onClick={() => setStage("amount")}
            className="mt-8 min-h-14 w-full rounded-xl bg-[#8E1F2D] px-6 text-base font-bold text-white"
          >
            ENTER PURCHASE AMOUNT
          </button>
          {error ? (
            <p className="mt-4 rounded-xl bg-[#FFF0F1] px-4 py-3 text-sm text-[#8E1F2D]">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  if (stage === "amount" && customer) {
    const estimatedPoints = estimateHubPoints(
      amountCents,
      customer.rewardsEnabled ? customer.pointsPerDollar : 0
    );
    return (
      <section className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden px-4 py-3 sm:px-6 md:px-8 md:py-5">
        <div className="flex shrink-0 items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#7A1D28]">
              Purchase amount
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171315] md:text-3xl">
              Enter the total
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setStage("found")}
            className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[#6D6669]"
          >
            Back
          </button>
        </div>

        <div className="mt-3 grid min-h-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-center sm:gap-4 md:grid-cols-[minmax(0,1fr)_22rem] md:gap-6">
          <div className="rounded-2xl border border-[#DED9DB] bg-white p-4 text-center md:p-7">
            <p className="truncate text-sm font-semibold text-[#6D6669]">
              {customer.displayName}
            </p>
            <p
              aria-label="Purchase amount"
              aria-live="polite"
              className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-[#171315] md:text-6xl"
            >
              {formatHubAmount(amountCents)}
            </p>
            <p className="mt-2 text-sm font-semibold text-[#8E1F2D] md:text-base">
              Estimated {estimatedPoints} point
              {estimatedPoints === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs text-[#81797C]">
              Final points are calculated when the purchase is confirmed.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {DIGITS.map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={busy}
                onClick={() => addAmountDigit(digit)}
                className="min-h-11 rounded-xl border border-[#D8D1D4] bg-white text-xl font-semibold text-[#171315] active:bg-[#EEE9EB] md:min-h-14 md:text-2xl"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              disabled={busy || amountCents === 0}
              onClick={() => setAmountCents(0)}
              className="min-h-11 rounded-xl border border-[#D8D1D4] bg-white text-sm font-semibold text-[#413B3E] disabled:opacity-35 md:min-h-14"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => addAmountDigit("0")}
              className="min-h-11 rounded-xl border border-[#D8D1D4] bg-white text-xl font-semibold text-[#171315] md:min-h-14 md:text-2xl"
            >
              0
            </button>
            <button
              type="button"
              disabled={busy || amountCents === 0}
              aria-label="Delete last amount digit"
              onClick={() => setAmountCents((value) => Math.floor(value / 10))}
              className="grid min-h-11 place-items-center rounded-xl border border-[#D8D1D4] bg-white text-[#413B3E] disabled:opacity-35 md:min-h-14"
            >
              <Delete className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled={amountCents === 0}
              onClick={() => setStage("confirm")}
              className="col-span-3 min-h-11 rounded-xl bg-[#8E1F2D] px-5 text-sm font-bold text-white disabled:bg-[#C7BFC2] md:min-h-14"
            >
              REVIEW PURCHASE
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (stage === "confirm" && customer) {
    return (
      <section className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-4 py-2 md:px-6 md:py-10">
        <div className="rounded-2xl border border-[#DED9DB] bg-white p-4 text-center md:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#81797C] md:text-sm">
            Confirm transaction
          </p>
          <h1 className="mt-1 break-words text-xl font-bold tracking-tight text-[#171315] md:mt-3 md:text-3xl">
            Confirm purchase for {customer.displayName}?
          </h1>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[#171315] md:mt-5 md:text-4xl">
            {formatHubAmount(amountCents)}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#8E1F2D] md:mt-2 md:text-base">
            Estimated{" "}
            {estimateHubPoints(
              amountCents,
              customer.rewardsEnabled ? customer.pointsPerDollar : 0
            )}{" "}
            points
          </p>
          <p className="mt-1 text-sm text-[#6D6669] md:mt-3 md:text-base">
            {customer.status === "pending"
              ? "Points will be saved in rewards for this store only."
              : "Points will be awarded to this customer account."}
          </p>
          {error ? (
            <p className="mt-2 rounded-xl bg-[#FFF0F1] px-4 py-2 text-sm text-[#8E1F2D] md:mt-5 md:py-3">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirmPurchase()}
            className="mt-3 min-h-11 w-full rounded-xl bg-[#8E1F2D] px-6 text-base font-bold text-white disabled:opacity-50 md:mt-8 md:min-h-16 md:text-lg"
          >
            {busy ? "CONFIRMING…" : "CONFIRM PURCHASE"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setStage("amount")}
            className="mt-1 min-h-11 w-full rounded-xl text-sm font-semibold text-[#6D6669] md:mt-3 md:min-h-12"
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
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#81797C]">
            Create rewards for this store only. This does not create or verify a
            FINDIT account.
          </p>
          {error ? (
            <p className="mt-5 rounded-xl bg-[#FFF0F1] px-4 py-3 text-sm text-[#8E1F2D]">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void createPendingCustomer()}
            className="mt-8 min-h-14 w-full rounded-xl bg-[#8E1F2D] px-6 text-base font-bold text-white disabled:opacity-50"
          >
            {busy ? "CREATING…" : "CREATE STORE REWARDS ACCOUNT"}
          </button>
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
    <section className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center overflow-hidden px-4 py-3 sm:px-6 md:py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#7A1D28]">
            Find Customer
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#171315] md:text-3xl">
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
        className="mt-3 flex min-h-14 items-center justify-center rounded-2xl border border-[#CEC7CA] bg-white px-6 text-center text-2xl font-semibold tracking-[0.08em] text-[#171315] md:min-h-16 md:text-3xl"
      >
        {digits ? formatUsNationalInput(digits) : "(___) ___-____"}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-[#FFF0F1] px-4 py-3 text-sm text-[#8E1F2D]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2 md:gap-3">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={busy}
            onClick={() => addDigit(digit)}
            className="min-h-11 rounded-xl border border-[#D8D1D4] bg-white text-xl font-semibold text-[#171315] active:bg-[#EEE9EB] md:min-h-12 md:text-2xl"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          disabled={busy || digits.length === 0}
          aria-label="Delete last digit"
          onClick={() => setDigits((value) => value.slice(0, -1))}
          className="grid min-h-11 place-items-center rounded-xl border border-[#D8D1D4] bg-white text-[#413B3E] disabled:opacity-35 md:min-h-12"
        >
          <Delete className="h-6 w-6" />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => addDigit("0")}
          className="min-h-11 rounded-xl border border-[#D8D1D4] bg-white text-xl font-semibold text-[#171315] md:min-h-12 md:text-2xl"
        >
          0
        </button>
        <button
          type="button"
          disabled={busy || digits.length !== 10}
          onClick={() => void search()}
          className="min-h-11 rounded-xl bg-[#8E1F2D] px-3 text-sm font-bold text-white disabled:bg-[#C7BFC2] md:min-h-12"
        >
          {busy ? "SEARCHING…" : "SEARCH"}
        </button>
      </div>
    </section>
  );
}
