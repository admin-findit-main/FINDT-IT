"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/logo";

function resourcePercent(): number {
  if (typeof performance === "undefined") return 12;
  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  const resources = performance.getEntriesByType(
    "resource"
  ) as PerformanceResourceTiming[];

  let loaded = 0;
  let total = 0;
  for (const entry of resources) {
    const size = entry.transferSize || entry.encodedBodySize || 1;
    total += size;
    if (entry.responseEnd > 0) loaded += size;
  }
  const fromResources = total > 0 ? (loaded / total) * 100 : 0;

  let fromNav = 18;
  if (nav) {
    if (nav.loadEventEnd > 0) fromNav = 100;
    else if (nav.domComplete > 0) fromNav = 88;
    else if (nav.domContentLoadedEventEnd > 0) fromNav = 64;
    else if (nav.responseEnd > 0) fromNav = 42;
    else if (nav.requestStart > 0) fromNav = 24;
  }

  return Math.max(8, Math.min(99, Math.round(Math.max(fromNav, fromResources))));
}

export function LoadMark({ percent, label }: { percent: number; label?: string }) {
  const shown = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="grid min-h-[40vh] place-items-center px-6 py-16">
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <BrandLogo kind="mark" className="h-10 w-auto" />
        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${shown}%` }}
          />
        </div>
        <p className="mt-3 text-sm font-semibold tabular-nums text-ink">
          {shown}%
        </p>
        <p className="mt-1 text-xs text-ink-muted">{label || "Loading FINDIT"}</p>
      </div>
    </div>
  );
}

/** Accurate % from completed network work (resources + in-flight fetches). */
export function LoadProgressHost() {
  const [visible, setVisible] = useState(false);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    let inflight = 0;
    let started = 0;
    let done = 0;
    let hideTimer: number | undefined;
    const orig = window.fetch;

    const show = (next: number) => {
      setVisible(true);
      setPercent(Math.max(0, Math.min(100, next)));
    };

    window.fetch = async (...args) => {
      inflight += 1;
      started += 1;
      show(Math.min(90, Math.round((done / Math.max(started, 1)) * 90) || 12));
      try {
        return await orig(...args);
      } finally {
        inflight -= 1;
        done += 1;
        const fromFetch = started ? Math.round((done / started) * 100) : 100;
        const mixed = Math.max(fromFetch, resourcePercent());
        show(inflight ? Math.min(95, mixed) : 100);
        if (!inflight) {
          window.clearTimeout(hideTimer);
          hideTimer = window.setTimeout(() => {
            setVisible(false);
            setPercent(0);
            started = 0;
            done = 0;
          }, 220);
        }
      }
    };

    return () => {
      window.fetch = orig;
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] pt-[env(safe-area-inset-top)]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Loading"
    >
      <div className="h-0.5 w-full bg-transparent">
        <div
          className="h-0.5 bg-accent transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function RouteLoading() {
  const [percent, setPercent] = useState(12);

  useEffect(() => {
    setPercent(resourcePercent());
    const id = window.setInterval(() => {
      setPercent((prev) => {
        const next = resourcePercent();
        if (next >= 100) return 100;
        return Math.max(prev, Math.min(99, next === prev ? prev + 1 : next));
      });
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  return <LoadMark percent={percent} />;
}
