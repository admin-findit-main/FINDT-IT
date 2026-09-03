"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";

export function sendStageLabel(percent: number) {
  if (percent >= 100) return "Live";
  if (percent >= 70) return "Syncing with stores";
  if (percent >= 35) return "Finding nearby stores";
  return "Sending your Find";
}

export function useClimbingPercent(active: boolean, ceiling = 90) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    if (!active) {
      setPercent(0);
      return;
    }
    setPercent(12);
    const started = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - started;
      setPercent(Math.min(ceiling, 12 + Math.floor(elapsed / 90)));
    }, 160);
    return () => window.clearInterval(id);
  }, [active, ceiling]);

  return percent;
}

export function SyncLine({
  percent,
  label,
}: {
  percent: number;
  label?: string;
}) {
  const shown = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className="flex items-center gap-3"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
      aria-label={label || "Syncing"}
    >
      <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200"
          style={{ width: `${shown}%` }}
        />
      </div>
      <p className="shrink-0 text-xs font-semibold tabular-nums text-ink-muted">
        {shown}%{label ? ` · ${label}` : ""}
      </p>
    </div>
  );
}

export function FindProgress({
  percent,
  label,
  size = "card",
}: {
  percent: number;
  label?: string;
  size?: "card" | "page" | "inline";
}) {
  const shown = Math.max(0, Math.min(100, Math.round(percent)));
  const body = (
    <div
      className="flex w-full max-w-xs flex-col items-center text-center"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
      aria-label={label || "Sending"}
    >
      <BrandLogo kind="mark" className="h-8 w-auto" />
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200"
          style={{ width: `${shown}%` }}
        />
      </div>
      <p className="mt-2 text-sm font-semibold tabular-nums text-ink">{shown}%</p>
      <p className="mt-1 text-xs text-ink-muted">{label || "Sending your Find"}</p>
    </div>
  );
  if (size === "inline") return body;
  if (size === "page") {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6">{body}</div>
    );
  }
  return <div className="grid place-items-center px-6 py-6">{body}</div>;
}

export function FindSendOverlay({
  percent,
  label,
}: {
  percent: number;
  label?: string;
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[var(--canvas)]/88 px-6 backdrop-blur-md">
      <FindProgress
        percent={percent}
        label={label || sendStageLabel(percent)}
        size="inline"
      />
    </div>
  );
}

export function LoadMark({ percent, label }: { percent: number; label?: string }) {
  return <FindProgress percent={percent} label={label} size="card" />;
}

export function AppScreenLoader({
  label = "Loading FINDIT",
  tone = "light",
}: {
  label?: string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div
      className={
        dark
          ? "grid min-h-dvh place-items-center bg-[#0B0B0C] px-6 text-white"
          : "grid min-h-dvh place-items-center bg-canvas px-6 text-ink"
      }
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <BrandLogo kind="mark" tone={dark ? "dark" : "light"} className="h-9 w-auto" />
        <div
          className={`mt-5 h-1.5 w-full overflow-hidden rounded-full ${
            dark ? "bg-white/15" : "bg-ink-100"
          }`}
        >
          <div className="findit-route-bar h-full w-1/3 rounded-full bg-accent" />
        </div>
        <p className={`mt-3 text-sm font-semibold ${dark ? "text-white/80" : "text-ink"}`}>
          {label}
        </p>
      </div>
    </div>
  );
}

export function RouteBusyBar() {
  return <AppScreenLoader />;
}

export function LoadProgressHost() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a");
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      if (link.target && link.target !== "_self") return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      try {
        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }
      } catch {
        return;
      }
      setVisible(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] pt-[env(safe-area-inset-top)]"
      role="progressbar"
      aria-label="Loading"
    >
      <div className="h-0.5 w-full overflow-hidden bg-transparent">
        <div className="findit-route-bar h-0.5 w-1/3 bg-accent" />
      </div>
    </div>
  );
}

export function RouteLoading() {
  return <RouteBusyBar />;
}
