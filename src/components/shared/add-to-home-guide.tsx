"use client";

import { MoreVertical, Plus, Share } from "lucide-react";
import type { InstallSurface } from "@/lib/pwa";
import { cn } from "@/lib/utils";

function IosShareGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path
        d="M12 3v11"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      <path
        d="M8.2 6.8 12 3l3.8 3.8"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 10.5v8A2.5 2.5 0 0 0 9 21h6a2.5 2.5 0 0 0 2.5-2.5v-8"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PulseRing({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-0 rounded-full bg-[#E5231B]/20 animate-ping",
        className
      )}
      aria-hidden
    />
  );
}

function SafariToolbarSign({ product }: { product: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline-strong bg-[#F4F4F6]">
      <div className="border-b border-hairline-strong bg-white px-3 py-2">
        <div className="mx-auto h-2.5 w-24 rounded-full bg-black/[0.08]" />
        <p className="mt-2 truncate text-center text-[11px] font-medium text-ink-muted">
          {product}
        </p>
      </div>
      <div className="relative flex h-16 items-end justify-around px-4 pb-3 pt-6">
        <span className="h-5 w-5 rounded-md bg-black/[0.08]" aria-hidden />
        <span className="h-5 w-5 rounded-md bg-black/[0.08]" aria-hidden />
        <span className="relative grid h-10 w-10 place-items-center">
          <PulseRing />
          <span className="relative z-10 grid h-9 w-9 place-items-center rounded-xl bg-white text-[#E5231B] shadow-[0_4px_14px_rgba(229,35,27,0.25)] ring-2 ring-[#E5231B]/35">
            <IosShareGlyph className="h-5 w-5" />
          </span>
        </span>
        <span className="h-5 w-5 rounded-md bg-black/[0.08]" aria-hidden />
        <span className="h-5 w-5 rounded-md bg-black/[0.08]" aria-hidden />
      </div>
      <p className="border-t border-hairline-strong bg-white px-3 py-2.5 text-center text-xs font-semibold text-ink">
        Tap Share at the bottom of Safari
      </p>
    </div>
  );
}

function ChromeMenuSign({
  product,
  where,
}: {
  product: string;
  where: "top-right" | "bottom";
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline-strong bg-[#F4F4F6]">
      <div className="relative flex items-center gap-2 border-b border-hairline-strong bg-white px-3 py-2.5">
        <div className="h-7 flex-1 rounded-full bg-black/[0.06] px-3 text-[11px] leading-7 text-ink-muted truncate">
          {product}
        </div>
        {where === "top-right" ? (
          <span className="relative grid h-10 w-10 shrink-0 place-items-center">
            <PulseRing />
            <span className="relative z-10 grid h-9 w-9 place-items-center rounded-xl bg-white text-ink shadow-[0_4px_14px_rgba(11,11,12,0.12)] ring-2 ring-[#E5231B]/35">
              <MoreVertical className="h-5 w-5" strokeWidth={2.2} aria-hidden />
            </span>
          </span>
        ) : (
          <span className="h-7 w-7 rounded-lg bg-black/[0.06]" aria-hidden />
        )}
      </div>
      <div className="space-y-2 px-3 py-3">
        <div className="rounded-xl border border-hairline-strong bg-white px-3 py-2.5 text-sm text-ink">
          <span className="inline-flex items-center gap-2 font-semibold">
            <Plus className="h-4 w-4 text-[#E5231B]" strokeWidth={2.2} aria-hidden />
            Install app / Add to Home screen
          </span>
        </div>
        <p className="text-center text-xs font-semibold text-ink">
          {where === "top-right"
            ? "Tap the ⋮ menu, then Install app"
            : "Open the menu, then Add to Home Screen"}
        </p>
      </div>
    </div>
  );
}

function DesktopSign({ product }: { product: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline-strong bg-[#F4F4F6]">
      <div className="relative flex items-center gap-2 border-b border-hairline-strong bg-white px-3 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-black/[0.12]" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/[0.12]" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/[0.12]" />
        </div>
        <div className="h-7 flex-1 rounded-md bg-black/[0.06] px-3 text-[11px] leading-7 text-ink-muted truncate">
          {product}
        </div>
        <span className="relative grid h-10 w-10 shrink-0 place-items-center">
          <PulseRing />
          <span className="relative z-10 grid h-9 w-9 place-items-center rounded-xl bg-white text-ink shadow-[0_4px_14px_rgba(11,11,12,0.12)] ring-2 ring-[#E5231B]/35">
            <Share className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          </span>
        </span>
      </div>
      <p className="bg-white px-3 py-2.5 text-center text-xs font-semibold text-ink">
        Look for Install in the address bar or browser menu
      </p>
    </div>
  );
}

const COPY: Record<
  Exclude<InstallSurface, "standalone">,
  { browser: string; steps: string[] }
> = {
  "ios-safari": {
    browser: "Safari",
    steps: [
      "Tap Share (square with ↑) at the bottom",
      "Scroll and tap Add to Home Screen",
      "Tap Add — then open FINDIT from your Home Screen",
    ],
  },
  "ios-chrome": {
    browser: "Chrome on iPhone",
    steps: [
      "Tap Share in Chrome’s menu",
      "Choose Add to Home Screen",
      "For the best app feel, you can also open this page in Safari and add it there",
    ],
  },
  "android-prompt": {
    browser: "Chrome",
    steps: [
      "Tap Install when prompted",
      "Or open the ⋮ menu → Install app / Add to Home screen",
    ],
  },
  "android-manual": {
    browser: "Chrome",
    steps: [
      "Tap the ⋮ menu at the top right",
      "Choose Install app or Add to Home screen",
      "Open the icon from your Home Screen",
    ],
  },
  desktop: {
    browser: "this browser",
    steps: [
      "Look for an Install icon in the address bar",
      "Or open the browser menu → Install FINDIT / Cast…",
    ],
  },
};

export function AddToHomeGuide({
  surface,
  productName = "FINDIT",
  compact = false,
  className,
}: {
  surface: InstallSurface;
  productName?: string;
  compact?: boolean;
  className?: string;
}) {
  if (surface === "standalone") return null;
  const copy = COPY[surface];

  return (
    <div className={cn("space-y-3", className)}>
      {!compact ? (
        surface === "ios-safari" ? (
          <SafariToolbarSign product={productName} />
        ) : surface === "ios-chrome" ? (
          <ChromeMenuSign product={productName} where="bottom" />
        ) : surface === "desktop" ? (
          <DesktopSign product={productName} />
        ) : (
          <ChromeMenuSign product={productName} where="top-right" />
        )
      ) : null}

      <div className="rounded-xl border border-hairline-strong bg-white px-3.5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {copy.browser}
        </p>
        <ol className={cn("mt-2 space-y-2", compact && "space-y-1.5")}>
          {copy.steps.map((step, index) => (
            <li key={step} className="flex gap-2.5 text-sm leading-snug text-ink">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-black/[0.05] text-[11px] font-bold text-ink-muted">
                {index + 1}
              </span>
              <span>{step.replace(/FINDIT/g, productName)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
