"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Delete, UserRoundSearch } from "lucide-react";
import { formatUsNationalInput } from "@findit/domain";
import {
  estimateHubPoints,
  formatHubAmount,
  hubZeroPointsCopy,
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

function KeypadKey({
  children,
  label,
  disabled,
  onPress,
  tone = "number",
  className = "",
}: {
  children: ReactNode;
  label?: string;
  disabled?: boolean;
  onPress: () => void;
  tone?: "number" | "utility" | "primary";
  className?: string;
}) {
  const toneClasses = {
    number:
      "border-white/10 bg-[#2A2528] text-white hover:bg-[#363034] active:border-white/25 active:bg-[#1D1A1C]",
    utility:
      "border-white/10 bg-[#211D1F] text-white/75 hover:bg-[#302A2D] hover:text-white active:bg-[#171315]",
    primary:
      "border-[#A92B3B] bg-[#A92B3B] text-white hover:bg-[#912332] active:border-[#741824] active:bg-[#741824]",
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      className={`grid min-h-11 min-w-0 place-items-center border text-xl font-bold tabular-nums transition-[background-color,border-color,color,transform] duration-100 focus-visible:z-10 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#F2A1AB] active:translate-y-px disabled:pointer-events-none disabled:border-white/5 disabled:bg-[#262123] disabled:text-white/25 md:min-h-14 md:text-2xl ${toneClasses[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

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
    rewardsEnabled: boolean;
    pointsPerDollar: number;
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
      rewardsEnabled: customer.rewardsEnabled,
      pointsPerDollar: customer.pointsPerDollar,
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
    const zeroPoints =
      success.pointsAwarded === 0
        ? hubZeroPointsCopy({
            rewardsEnabled: success.rewardsEnabled,
            amountCents: success.amountCents,
            pointsPerDollar: success.pointsPerDollar,
          })
        : null;
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
        {zeroPoints ? (
          <>
            <p className="mt-4 text-2xl font-bold text-[#171315] md:mt-6 md:text-3xl">
              {zeroPoints.headline}
            </p>
            <p className="mt-1 text-base text-[#6D6669] md:mt-2 md:text-lg">
              {zeroPoints.reason}
            </p>
          </>
        ) : (
          <p className="mt-4 text-2xl font-bold text-[#8E1F2D] md:mt-6 md:text-3xl">
            +{success.pointsAwarded} points
          </p>
        )}
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
      <section
        data-hub-customer-workspace="amount"
        className="mx-auto grid h-full w-full max-w-6xl grid-cols-[minmax(0,1fr)_minmax(9.5rem,42%)] grid-rows-[minmax(0,1fr)] gap-1 overflow-hidden p-1 min-[480px]:grid-cols-[minmax(0,1fr)_minmax(12rem,42%)] min-[480px]:gap-2 min-[480px]:p-2 md:gap-6 md:p-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div className="flex min-h-0 min-w-0 flex-col justify-center border-r border-[#DED9DB] px-1 pr-2 min-[480px]:px-2 min-[480px]:pr-4 md:px-3 md:pr-10">
          <div className="flex min-w-0 items-start justify-between gap-1 min-[480px]:gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8E1F2D] md:text-sm">
                Purchase amount
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-[#171315] md:text-3xl">
                Enter the total
              </h1>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStage("found")}
              className="min-h-11 shrink-0 px-3 text-sm font-semibold text-[#5F585B] transition-colors hover:text-[#171315] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#8E1F2D] disabled:opacity-35"
            >
              ← Back
            </button>
          </div>
          <div className="@container mt-2 min-w-0 border-l-4 border-[#8E1F2D] bg-white px-2 py-2 min-[480px]:px-4 min-[480px]:py-3 md:mt-6 md:px-6 md:py-5">
            <p className="truncate text-sm font-semibold text-[#6D6669]">
              {customer.displayName}
            </p>
            <p
              aria-label="Purchase amount"
              aria-live="polite"
              data-hub-number-display="amount"
              className="mt-1 whitespace-nowrap text-[clamp(1.125rem,10cqw,3.5rem)] font-black leading-none tabular-nums tracking-[-0.045em] text-[#171315] md:mt-2"
            >
              {formatHubAmount(amountCents)}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm md:mt-3 md:text-base">
              {customer.rewardsEnabled ? (
                <>
                  <span className="font-bold text-[#8E1F2D]">
                    {estimatedPoints} estimated point
                    {estimatedPoints === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs text-[#81797C]">
                    Calculated at confirmation
                  </span>
                </>
              ) : (
                <span className="font-semibold text-[#6D6669]">
                  Rewards are turned off for this store
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          data-hub-keypad="amount"
          className="flex min-h-0 min-w-0 flex-col justify-center bg-[#171315] p-1 md:p-4"
        >
          <p className="mb-1 truncate px-0.5 text-[9px] font-bold uppercase leading-3 tracking-[0.1em] text-white/45 min-[480px]:text-[10px] md:mb-2 md:px-1 md:text-[11px] md:tracking-[0.16em]">
            Amount keypad
            <span className="sr-only"> · cents enter automatically</span>
          </p>
          <div className="grid grid-cols-3 gap-1 md:gap-2">
            {DIGITS.map((digit) => (
              <KeypadKey
                key={digit}
                disabled={busy || amountCents === MAX_HUB_AMOUNT_CENTS}
                onPress={() => addAmountDigit(digit)}
              >
                {digit}
              </KeypadKey>
            ))}
            <KeypadKey
              disabled={busy || amountCents === 0}
              onPress={() => setAmountCents(0)}
              tone="utility"
              className="text-xs md:text-sm"
            >
              CLEAR
            </KeypadKey>
            <KeypadKey
              disabled={busy || amountCents === MAX_HUB_AMOUNT_CENTS}
              onPress={() => addAmountDigit("0")}
            >
              0
            </KeypadKey>
            <KeypadKey
              label="Delete last amount digit"
              disabled={busy || amountCents === 0}
              onPress={() =>
                setAmountCents((value) => Math.floor(value / 10))
              }
              tone="utility"
            >
              <Delete className="h-5 w-5" />
            </KeypadKey>
          </div>
          <KeypadKey
            disabled={busy || amountCents === 0}
            onPress={() => setStage("confirm")}
            tone="primary"
            className="mt-1 px-1 text-[10px] tracking-[0.02em] min-[480px]:text-xs md:mt-2 md:px-4 md:text-base md:tracking-[0.04em]"
          >
            REVIEW PURCHASE
          </KeypadKey>
        </div>
      </section>
    );
  }

  if (stage === "confirm" && customer) {
    const estimatedPoints = customer.rewardsEnabled
      ? estimateHubPoints(amountCents, customer.pointsPerDollar)
      : 0;
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
          {customer.rewardsEnabled ? (
            <>
              <p className="mt-1 text-sm font-semibold text-[#8E1F2D] md:mt-2 md:text-base">
                Estimated {estimatedPoints} point
                {estimatedPoints === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-sm text-[#6D6669] md:mt-3 md:text-base">
                {customer.status === "pending"
                  ? "Points will be saved in rewards for this store only."
                  : "Points will be awarded to this customer account."}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-[#6D6669] md:mt-3 md:text-base">
              Rewards are turned off for this store. No points will be awarded.
            </p>
          )}
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
    <section
      data-hub-customer-workspace="phone"
      className="mx-auto grid h-full w-full max-w-5xl grid-cols-[minmax(0,1fr)_minmax(9.5rem,42%)] grid-rows-[minmax(0,1fr)] gap-1 overflow-hidden p-1 min-[480px]:grid-cols-[minmax(0,1fr)_minmax(12rem,42%)] min-[480px]:gap-2 min-[480px]:p-2 md:gap-6 md:p-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
    >
      <div className="flex min-h-0 min-w-0 flex-col justify-center border-r border-[#DED9DB] px-1 pr-2 min-[480px]:px-2 min-[480px]:pr-4 md:px-3 md:pr-10">
        <div className="flex min-w-0 items-start justify-between gap-1 min-[480px]:gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8E1F2D] md:text-sm">
              Find customer
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-[#171315] md:text-3xl">
              Phone lookup
            </h1>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={reset}
            className="min-h-11 shrink-0 px-3 text-sm font-semibold text-[#5F585B] transition-colors hover:text-[#171315] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#8E1F2D] disabled:opacity-35"
          >
            Cancel
          </button>
        </div>

        <div className="@container mt-2 min-w-0 border-l-4 border-[#8E1F2D] bg-white px-2 py-2 min-[480px]:px-4 min-[480px]:py-3 md:mt-6 md:px-6 md:py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#81797C]">
            Customer phone number
          </p>
          <div
            aria-label="Customer phone number"
            aria-live="polite"
            data-hub-number-display="phone"
            className="mt-1 whitespace-nowrap text-[clamp(1.125rem,9cqw,3rem)] font-black leading-none tabular-nums tracking-[-0.025em] text-[#171315] md:mt-2"
          >
            {digits ? formatUsNationalInput(digits) : "(•••) •••-••••"}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-[#81797C]">
              {digits.length} of 10 digits
            </p>
            <button
              type="button"
              disabled={busy || digits.length === 0}
              onClick={() => {
                setDigits("");
                setError(null);
              }}
              className="min-h-11 px-2 text-xs font-bold tracking-[0.04em] text-[#6D6669] transition-colors hover:text-[#8E1F2D] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#8E1F2D] disabled:opacity-30"
            >
              CLEAR NUMBER
            </button>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 border-l-4 border-[#B42332] bg-[#FFF0F1] px-3 py-2 text-sm font-medium text-[#8E1F2D]"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div
        data-hub-keypad="phone"
        className="flex min-h-0 min-w-0 flex-col justify-center bg-[#171315] p-1 md:p-4"
      >
        <p className="mb-1 px-0.5 text-[9px] font-bold uppercase leading-3 tracking-[0.1em] text-white/45 min-[480px]:text-[10px] md:mb-2 md:px-1 md:text-[11px] md:tracking-[0.16em]">
          Customer keypad
        </p>
        <div className="grid grid-cols-3 gap-1 md:gap-2">
          {DIGITS.map((digit) => (
            <KeypadKey
              key={digit}
              disabled={busy || digits.length === 10}
              onPress={() => addDigit(digit)}
            >
              {digit}
            </KeypadKey>
          ))}
          <KeypadKey
            label="Delete last digit"
            disabled={busy || digits.length === 0}
            onPress={() => setDigits((value) => value.slice(0, -1))}
            tone="utility"
          >
            <Delete className="h-5 w-5 md:h-6 md:w-6" />
          </KeypadKey>
          <KeypadKey
            disabled={busy || digits.length === 10}
            onPress={() => addDigit("0")}
          >
            0
          </KeypadKey>
          <KeypadKey
            label="Search for customer"
            disabled={busy || digits.length !== 10}
            onPress={() => void search()}
            tone="primary"
            className="px-0.5 text-[9px] min-[480px]:text-[10px] md:px-0.5 md:text-[11px]"
          >
            {busy ? "WAIT…" : "SEARCH"}
          </KeypadKey>
        </div>
      </div>
    </section>
  );
}
