"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AddToHomeGuide } from "@/components/shared/add-to-home-guide";
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
  const [expanded, setExpanded] = useState(false);
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
    setExpanded(true);
  }

  const showNativeInstall =
    surface === "android-prompt" || (surface === "desktop" && canInstall);

  return (
    <div className="mb-8 mt-8 rounded-2xl border border-hairline-strong bg-white px-4 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      <p className="text-sm font-semibold text-ink">Add FINDIT to your Home Screen</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        {surface === "ios-safari"
          ? "Opens like an app. We’ll show exactly where to tap in Safari."
          : surface === "ios-chrome"
            ? "You’re in Chrome on iPhone. Here’s where to add it."
            : surface === "android-manual" || surface === "android-prompt"
              ? "Install from Chrome so FINDIT feels like an app."
              : "Install FINDIT for one-tap access without the browser bar."}
      </p>

      {(expanded ||
        surface === "ios-safari" ||
        surface === "ios-chrome" ||
        surface === "android-manual") && (
        <div className="mt-3">
          <AddToHomeGuide surface={surface} productName="FINDIT" />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {showNativeInstall ? (
          <Button type="button" size="sm" onClick={() => void install()}>
            Install
          </Button>
        ) : null}
        {!expanded &&
        (surface === "desktop" || surface === "android-prompt") &&
        !showNativeInstall ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setExpanded(true)}>
            Show me where
          </Button>
        ) : null}
        {surface === "android-prompt" && canInstall && !expanded ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setExpanded(true)}>
            Show menu steps
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
