"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUsNationalInput } from "@findit/domain";
import {
  addHubCustomerAction,
  confirmLookupPurchaseAction,
  getHubCustomersAction,
  lookupHubCustomerAction,
  removeHubCustomerAction,
  type CustomerLookupResult,
} from "@/lib/services/loyalty";
import { formatRelativeTime } from "@/lib/utils";

type LookupState = Exclude<CustomerLookupResult, { status: "error" }> | null;
type CustomerRow = Awaited<ReturnType<typeof getHubCustomersAction>>["rows"][number];

export function HubCustomerWorkspace() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<LookupState>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [operationId, setOperationId] = useState("");

  const refreshCustomers = useCallback(async () => {
    const loaded = await getHubCustomersAction();
    if ("error" in loaded && loaded.error) {
      setError(loaded.error);
      return;
    }
    setCustomers(loaded.rows);
  }, []);

  useEffect(() => {
    void refreshCustomers();
  }, [refreshCustomers]);

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

  async function addCustomer() {
    if (busy || result?.status !== "found") return;
    setBusy(true);
    setError(null);
    const added = await addHubCustomerAction(phone);
    setBusy(false);
    if (!added.ok) {
      setError(added.error);
      return;
    }
    setResult({
      ...result,
      relationshipId: added.relationshipId,
      isStoreCustomer: true,
      pointsBalance: added.pointsBalance,
    });
    setConfirmed("Customer added to this store.");
    await refreshCustomers();
  }

  async function confirmPurchase() {
    if (busy || result?.status !== "found") return;
    setBusy(true);
    setError(null);
    const purchase = await confirmLookupPurchaseAction({
      phone,
      operationId: operationId || crypto.randomUUID(),
    });
    setBusy(false);
    if (!purchase.ok) {
      setError(purchase.error);
      return;
    }
    setResult({
      ...result,
      isStoreCustomer: true,
      pointsBalance: purchase.pointsBalance,
      confirmedPurchases:
        result.confirmedPurchases + (purchase.alreadyConfirmed ? 0 : 1),
    });
    setConfirmed(
      purchase.alreadyConfirmed
        ? "Purchase already confirmed."
        : purchase.pointsAwarded > 0
          ? `Purchase confirmed · +${purchase.pointsAwarded} points`
          : "Purchase confirmed."
    );
    setOperationId(crypto.randomUUID());
    await refreshCustomers();
  }

  async function removeCustomer(id: string) {
    if (removingId) return;
    setRemovingId(id);
    setError(null);
    const removed = await removeHubCustomerAction(id);
    setRemovingId(null);
    if (!removed.ok) {
      setError(removed.error);
      return;
    }
    setCustomers((rows) => rows.filter((row) => row.id !== id));
    if (result?.status === "found" && result.relationshipId === id) {
      setResult({ ...result, isStoreCustomer: false });
      setConfirmed("Customer removed from this store. Purchase history was kept.");
    }
  }

  return (
    <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-5 overflow-hidden lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
      <section className="overflow-y-auto rounded-2xl border border-white/12 bg-white/[0.04] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
          Look up or add
        </p>
        <h1 className="mt-2 text-3xl font-bold">Customers</h1>
        <p className="mt-2 text-sm text-white/55">
          Use the shopper’s FINDIT email or verified phone.
        </p>

        <form
          className="mt-6 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void lookup();
          }}
        >
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            value={phone}
            onChange={(event) => {
              const value = event.target.value;
              setPhone(
                value.includes("@") || /[a-z]/i.test(value)
                  ? value
                  : formatUsNationalInput(value)
              );
              setResult(null);
              setConfirmed(null);
              setError(null);
            }}
            placeholder="Email or phone"
            className="min-h-14 min-w-0 flex-1 rounded-xl bg-black/50 px-4 text-xl outline-none ring-1 ring-white/15 focus:ring-white/40"
          />
          <button
            type="submit"
            disabled={busy || phone.trim().length < 3}
            className="min-h-14 rounded-xl bg-white px-5 font-bold text-black disabled:opacity-40"
          >
            {busy ? "Finding…" : "Look up"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-xl border border-[#E5231B]/40 bg-[#E5231B]/15 px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}
        {confirmed ? (
          <p className="mt-4 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
            {confirmed}
          </p>
        ) : null}

        {result?.status === "not_found" ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="text-lg font-semibold">No customer found</p>
            <p className="mt-1 text-sm text-white/55">
              Check the email, or ask the shopper to verify their phone in FINDIT.
            </p>
          </div>
        ) : null}

        {result?.status === "found" ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-bold">{result.displayName}</p>
                <p className="mt-1 text-sm text-white/45">{result.maskedPhone}</p>
                <p className="mt-2 text-sm text-white/60">
                  {result.confirmedPurchases} purchase
                  {result.confirmedPurchases === 1 ? "" : "s"} at this store
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums">
                  {result.pointsBalance}
                </p>
                <p className="text-xs uppercase tracking-wider text-white/45">
                  points
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {!result.isStoreCustomer ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void addCustomer()}
                  className="min-h-14 rounded-xl bg-white font-bold text-black disabled:opacity-40"
                >
                  Add customer
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void confirmPurchase()}
                  className="min-h-14 rounded-xl bg-[#0E9F6E] font-bold disabled:opacity-40"
                >
                  Confirm purchase
                </button>
              )}
              {result.isStoreCustomer && result.relationshipId ? (
                <button
                  type="button"
                  disabled={Boolean(removingId)}
                  onClick={() => void removeCustomer(result.relationshipId!)}
                  className="min-h-14 rounded-xl border border-white/15 text-sm font-semibold text-white/70 disabled:opacity-40"
                >
                  Remove from store
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04]">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-lg font-bold">Store customers</p>
          <p className="mt-1 text-sm text-white/45">
            {customers.length} active customer{customers.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {customers.length === 0 ? (
            <p className="px-5 py-8 text-sm text-white/50">
              Look up a verified shopper and add them to this store.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {customers.map((customer) => (
                <li
                  key={customer.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{customer.displayName}</p>
                    <p className="mt-1 text-xs text-white/40">
                      {customer.maskedPhone} · Last activity{" "}
                      {formatRelativeTime(customer.lastSeenAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{customer.pointsBalance}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/35">
                      points
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={removingId === customer.id}
                    onClick={() => void removeCustomer(customer.id)}
                    className="min-h-11 rounded-xl border border-white/15 px-3 text-xs font-semibold text-white/55 disabled:opacity-40"
                  >
                    {removingId === customer.id ? "Removing…" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
