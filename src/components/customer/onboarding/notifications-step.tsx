"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  requestBrowserNotifyPermission,
  type BrowserNotifyPermission,
} from "@/lib/browser-notify";
import { canRequestWebPush } from "@/lib/pwa";
import { subscribeWebPush } from "@/lib/web-push-client";
import { trackShopperOnboardingEventAction } from "@/lib/services/onboarding-actions";

export function NotificationsStep({
  permission,
  iosNeedsHomeScreen,
  onContinue,
}: {
  permission: BrowserNotifyPermission;
  iosNeedsHomeScreen: boolean;
  onContinue: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const canAsk = canRequestWebPush() && permission === "default" && !iosNeedsHomeScreen;

  async function enable() {
    if (!canAsk) {
      onContinue();
      return;
    }
    setBusy(true);
    void trackShopperOnboardingEventAction("notifications_requested");
    try {
      const next = await requestBrowserNotifyPermission();
      if (next === "granted") {
        void trackShopperOnboardingEventAction("notifications_granted");
        const subscribed = await subscribeWebPush();
        if (!subscribed.ok && subscribed.error !== "ios-homescreen") {
          console.error("[FINDIT] onboarding push subscribe", subscribed.error);
        }
      } else if (next === "denied") {
        void trackShopperOnboardingEventAction("notifications_denied");
      }
    } catch (err) {
      console.error("[FINDIT] notification permission failed", err);
    }
    setBusy(false);
    onContinue();
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
          Know the moment it&apos;s found.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">
          Allow notifications so FINDIT can tell you when a nearby store responds
          to your request.
        </p>

        {/* Deliberately keeps iOS banner geometry: this is a picture of a
            system notification, not a FINDIT panel. */}
        <div
          className="mt-8 rounded-[1.35rem] border border-hairline-strong bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          aria-hidden
        >
          <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-muted">
            FINDIT
          </p>
          <p className="mt-1 text-[1.05rem] font-semibold text-ink">We found it.</p>
          <p className="mt-0.5 text-sm text-ink-muted">2 nearby stores responded.</p>
        </div>

        {iosNeedsHomeScreen ? (
          <p className="mt-6 text-sm leading-relaxed text-ink-muted">
            Add FINDIT to your Home Screen first. Then open FINDIT there to enable
            notifications.
          </p>
        ) : null}

        {permission === "denied" ? (
          <p className="mt-6 text-sm leading-relaxed text-ink-muted">
            Notifications are off. Leave FINDIT open while you wait. Enable
            alerts in your device or browser settings if you want a ping after
            you switch away.
          </p>
        ) : null}
      </div>

      <div className="mt-8 space-y-2">
        {permission === "denied" || iosNeedsHomeScreen ? (
          <Button type="button" size="xl" className="w-full" onClick={onContinue}>
            Continue
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="xl"
              className="w-full"
              disabled={busy}
              onClick={() => void enable()}
            >
              {busy ? "Turning on…" : "Enable Notifications"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className="h-12 w-full"
              onClick={onContinue}
            >
              Not now
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
