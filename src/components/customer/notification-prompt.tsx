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
import {
  isIosDevice,
  isStandaloneDisplay,
  subscribeWebPush,
} from "@/lib/web-push-client";
import {
  readShopperOnboardingState,
  WEB_NOTIFY_PROMPT_DISMISS_KEY,
} from "@/lib/customer/onboarding-state";
import { WAITING_FOR_REPLY_HINT } from "@/lib/config/constants";

export function NotificationPrompt({
  compact = false,
  waiting = false,
  audience = "customer",
  className,
}: {
  compact?: boolean;
  waiting?: boolean;
  audience?: "customer" | "store";
  className?: string;
}) {
  const pathname = usePathname();
  const [permission, setPermission] = useState<ReturnType<
    typeof browserNotifyPermission
  > | null>(null);
  const [iosHomeScreen, setIosHomeScreen] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setPermission(browserNotifyPermission());
    setIosHomeScreen(isIosDevice() && !isStandaloneDisplay());
    try {
      setDismissed(localStorage.getItem(WEB_NOTIFY_PROMPT_DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (permission === null) return null;
  if (permission === "granted" && !waiting) return null;
  if (permission === "denied" && !waiting) {
    const onSettings =
      audience === "store"
        ? pathname === "/store/notifications"
        : pathname === "/notifications";
    if (!onSettings) return null;
    return (
      <p className={cn("text-sm text-ink-muted", compact ? "" : "px-5 pt-4 sm:px-8", className)}>
        Alerts are blocked in this browser. Turn them on in browser or device settings.
      </p>
    );
  }
  const onCustomerAlerts =
    pathname === "/notifications" || pathname.startsWith("/requests/");
  const onStoreAlerts =
    pathname === "/notifications" ||
    pathname === "/store/notifications" ||
    pathname.startsWith("/store/notifications");
  if (!waiting && !compact && audience === "customer" && onCustomerAlerts) {
    return null;
  }
  if (!waiting && audience === "store" && onStoreAlerts) {
    return null;
  }
  if (!waiting && dismissed) return null;
  if (
    !waiting &&
    audience === "customer" &&
    readShopperOnboardingState().notificationEducationSeen
  ) {
    return null;
  }

  async function enable() {
    if (iosHomeScreen) {
      toast.message("Add FINDIT to your Home Screen first. Then open FINDIT there to enable notifications.");
      return;
    }
    const next = await requestBrowserNotifyPermission();
    setPermission(next);
    if (next === "granted") {
      const subscribed = await subscribeWebPush();
      if (subscribed.ok) {
        toast.success(
          audience === "store"
            ? "We’ll ping this phone when a shopper asks nearby."
            : "We’ll ping this phone even after you close FINDIT."
        );
      } else if (subscribed.error === "ios-homescreen") {
        toast.message("Add FINDIT to your Home Screen to get alerts after you close it.");
      } else {
        toast.message("Couldn’t turn on lock-screen alerts. We’ll still update this screen.");
      }
    } else {
      toast.message("You can still see replies here and on Alerts.");
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(WEB_NOTIFY_PROMPT_DISMISS_KEY, "1");
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
          {waiting
            ? "Keep FINDIT open while you wait"
            : audience === "store"
              ? "Turn on store alerts"
              : "Turn on alerts"}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          {waiting
            ? permission === "granted"
              ? `${WAITING_FOR_REPLY_HINT} We’ll also ping this phone if you switch away.`
              : permission === "denied"
                ? `${WAITING_FOR_REPLY_HINT} Alerts are blocked, so replies only show here.`
                : `${WAITING_FOR_REPLY_HINT} Turn on notifications if you want a ping after you switch away.`
            : audience === "store"
              ? "Allow notifications so FINDIT can ping this phone when a nearby shopper asks, including after you close the app."
              : "We’ll notify this phone when a nearby store answers a Find, including after you close the app."}
        </p>
        {iosHomeScreen && permission !== "granted" ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            On iPhone, tap Share, then Add to Home Screen, then open FINDIT from there and allow alerts.
          </p>
        ) : null}
        {permission === "granted" ? null : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void enable()}>
              Allow notifications
            </Button>
            {waiting ? null : (
              <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
                Not now
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
