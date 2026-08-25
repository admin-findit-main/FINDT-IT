"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  browserNotifyPermission,
  requestBrowserNotifyPermission,
} from "@/lib/browser-notify";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "findit-web-notify-prompt-dismissed";

export function NotificationPrompt({
  compact = false,
  waiting = false,
  className,
}: {
  compact?: boolean;
  waiting?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const [permission, setPermission] = useState<ReturnType<
    typeof browserNotifyPermission
  > | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setPermission(browserNotifyPermission());
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (permission === null || permission !== "default") return null;
  if (!waiting && !compact && (pathname === "/notifications" || pathname.startsWith("/requests/"))) {
    return null;
  }
  if (!waiting && dismissed) return null;

  async function enable() {
    const next = await requestBrowserNotifyPermission();
    setPermission(next);
    if (next === "granted") toast.success("Alerts are on for this device.");
    else toast.message("You can still see replies here and on Alerts.");
  }

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore private-mode storage failures.
    }
    setDismissed(true);
  }

  return (
    <div
      className={cn(
        compact
          ? "rounded-2xl border border-hairline-strong bg-white p-4"
          : "px-5 pt-4 sm:px-8",
        className
      )}
    >
      <div
        className={
          compact
            ? ""
            : "rounded-2xl border border-hairline-strong bg-white p-4"
        }
      >
        <p className="text-sm font-semibold text-ink">
          {waiting ? "Get an alert when a store answers" : "Turn on alerts"}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          {waiting
            ? "This page updates as stores reply. Allow notifications so you don’t miss one if you leave."
            : "We’ll notify you on this device when a nearby store answers a Find."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void enable()}>
            Allow alerts
          </Button>
          {waiting ? null : (
            <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
