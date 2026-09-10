"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getInstallSurface,
  isIosDevice,
  isStandaloneDisplay,
  shouldHoldForHomeScreen,
} from "@/lib/pwa";
import { usePwaInstall } from "@/lib/pwa-install";

const DISMISS_KEY = "findit.business.installHintDismissedAt";

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    // Re-show after 14 days if they still use a browser tab.
    return Date.now() - at < 14 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Browser tabs show Safari/Chrome chrome (URL bar, tab X, etc.).
 * Installed / Home Screen PWAs hide that — same path as the customer app.
 */
export function BusinessInstallHint() {
  const { canInstall, promptInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [surface, setSurface] = useState(getInstallSurface(false));

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setVisible(false);
      return;
    }
    if (!shouldHoldForHomeScreen() && !canInstall) {
      setVisible(false);
      return;
    }
    setSurface(getInstallSurface(canInstall));
    setVisible(!readDismissed());
  }, [canInstall]);

  if (!visible) return null;

  function dismiss() {
    writeDismissed();
    setVisible(false);
  }

  async function install() {
    const result = await promptInstall();
    if (result === "accepted") {
      writeDismissed();
      setVisible(false);
      return;
    }
    if (result !== "unavailable") dismiss();
  }

  const ios = surface === "ios-safari" || isIosDevice();

  return (
    <div className="mb-4 rounded-2xl border border-hairline-strong bg-white px-4 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      <p className="text-sm font-semibold text-ink">Open like an app</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        {ios
          ? "You’re in Safari. Tap Share → Add to Home Screen so FINDIT Business opens full-screen without the browser bar and tab buttons."
          : "Install FINDIT Business to hide the browser bar and open it like the customer app."}
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
