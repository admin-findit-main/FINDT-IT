"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  readShopperOnboardingState,
  shouldShowInstallHint,
  writeShopperOnboardingState,
} from "@/lib/customer/onboarding-state";
import { getInstallSurface, isStandaloneDisplay } from "@/lib/pwa";
import { usePwaInstall } from "@/lib/pwa-install";
import { trackShopperOnboardingEventAction } from "@/lib/services/onboarding-actions";

export function ShopperInstallHint() {
  const { canInstall, promptInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [surface, setSurface] = useState(getInstallSurface(false));

  useEffect(() => {
    const standalone = isStandaloneDisplay();
    const nextSurface = getInstallSurface(canInstall);
    setSurface(nextSurface);
    setVisible(
      shouldShowInstallHint({
        standalone,
        state: readShopperOnboardingState(),
      })
    );
  }, [canInstall]);

  if (!visible) return null;

  function dismiss() {
    writeShopperOnboardingState({ installHintDismissedAt: Date.now() });
    setVisible(false);
  }

  async function install() {
    void trackShopperOnboardingEventAction("pwa_install_clicked");
    const result = await promptInstall();
    if (result === "accepted") {
      void trackShopperOnboardingEventAction("pwa_installed");
      writeShopperOnboardingState({
        installSkipped: false,
        installHintDismissedAt: Date.now(),
      });
      setVisible(false);
      return;
    }
    if (result === "dismissed") {
      void trackShopperOnboardingEventAction("pwa_install_dismissed");
    }
    dismiss();
  }

  return (
    <div className="mb-8 mt-8 rounded-2xl bg-white px-4 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      <p className="text-sm font-semibold text-ink">Add FINDIT to your Home Screen</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        {surface === "ios-safari"
          ? "Tap Share, then Add to Home Screen, so FINDIT opens like an app."
          : "Get faster access and use FINDIT like an app."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {surface === "android-prompt" || canInstall ? (
          <Button type="button" size="sm" onClick={() => void install()}>
            Install
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
