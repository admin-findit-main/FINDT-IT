"use client";

import { ExternalLink, LogOut, Unplug } from "lucide-react";
import { PUBLIC_SUPPORT_EMAIL } from "@/lib/config/support";

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 border-b border-[#E8E3E5] py-4 sm:grid-cols-[10rem_1fr] sm:items-center">
      <dt className="text-sm font-medium text-[#81797C]">{label}</dt>
      <dd className="text-sm font-semibold text-[#302A2D]">{value}</dd>
    </div>
  );
}

export function HubSettingsWorkspace({
  storeName,
  deviceName,
  deviceConnected,
  online,
  employeeName,
  canPair,
  canClockOut,
  canSignOut,
  onPair,
  onClockOut,
  onSignOut,
}: {
  storeName: string;
  deviceName: string | null;
  deviceConnected: boolean;
  online: boolean;
  employeeName: string | null;
  canPair: boolean;
  canClockOut: boolean;
  canSignOut: boolean;
  onPair: () => void;
  onClockOut: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-8 md:px-10 md:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#7A1D28]">
        Settings
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#171315]">
        Hub settings
      </h1>

      <div className="mt-8 rounded-2xl border border-[#DED9DB] bg-white px-6">
        <dl>
          <Row label="Store" value={storeName || "FINDIT store"} />
          <Row label="Device" value={deviceName || "Browser session"} />
          <Row label="Connection" value={online ? "Online" : "Offline"} />
          <Row
            label="Pairing"
            value={deviceConnected ? "Connected to this store" : "Not paired"}
          />
          <Row label="Employee" value={employeeName || "Store account"} />
          <Row label="Wi-Fi" value="Managed in Android device settings" />
          <Row label="App version" value="0.1.0" />
        </dl>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a
          href={`mailto:${PUBLIC_SUPPORT_EMAIL}`}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-[#CEC7CA] bg-white px-5 text-sm font-bold text-[#302A2D]"
        >
          Support
          <ExternalLink className="h-4 w-4" />
        </a>
        {canPair ? (
          <button
            type="button"
            onClick={onPair}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-[#CEC7CA] bg-white px-5 text-sm font-bold text-[#302A2D]"
          >
            <Unplug className="h-4 w-4" />
            Pair this device
          </button>
        ) : null}
        {canClockOut ? (
          <button
            type="button"
            onClick={() => void onClockOut()}
            className="min-h-14 rounded-xl bg-[#8E1F2D] px-5 text-sm font-bold text-white"
          >
            Clock out
          </button>
        ) : null}
        {canSignOut ? (
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#171315] px-5 text-sm font-bold text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        ) : null}
      </div>
    </section>
  );
}
