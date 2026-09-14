"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AddToHomeGuide } from "@/components/shared/add-to-home-guide";
import {
  getInstallSurface,
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
  const [expanded, setExpanded] = useState(true);
  const [surface, setSurface] = useState(getInstallSurface(false));

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setVisible(false);
      return;
    }
    if (!shouldHoldForHomeScreen() && !canInstall) {
      // Still show a light desktop hint when install prompt exists.
      if (!canInstall) {
        setVisible(false);
        return;
      }
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
    if (result === "unavailable") {
      setExpanded(true);
      return;
    }
    setExpanded(true);
  }

  const showNativeInstall =
    surface === "android-prompt" || (surface === "desktop" && canInstall);

  return (
    <div className="mb-4 rounded-2xl border border-hairline-strong bg-white px-4 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      <p className="text-sm font-semibold text-ink">Open FINDIT Business like an app</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">
        Add it to your Home Screen so the browser bar and tabs stay out of the way.
      </p>

      {expanded ? (
        <div className="mt-3">
          <AddToHomeGuide
            surface={surface}
            productName="FINDIT Business"
          />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {showNativeInstall ? (
          <Button type="button" size="sm" onClick={() => void install()}>
            Install
          </Button>
        ) : null}
        {!expanded ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setExpanded(true)}>
            Show me where
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
