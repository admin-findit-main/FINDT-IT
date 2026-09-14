"use client";

import { useEffect, useState } from "react";
import { Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddToHomeGuide } from "@/components/shared/add-to-home-guide";
import { usePwaInstall } from "@/lib/pwa-install";
import { trackShopperOnboardingEventAction } from "@/lib/services/onboarding-actions";
import { isStandaloneDisplay, type InstallSurface } from "@/lib/pwa";

export function InstallStep({
  surface,
  holdForHomeScreen,
  onContinue,
  onSkip,
}: {
  surface: InstallSurface;
  holdForHomeScreen?: boolean;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { canInstall, promptInstall } = usePwaInstall();
  const [busy, setBusy] = useState(false);
  const [promptGone, setPromptGone] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    function maybeStart() {
      if (isStandaloneDisplay()) onContinue();
    }
    maybeStart();
    window.addEventListener("pageshow", maybeStart);
    document.addEventListener("visibilitychange", maybeStart);
    return () => {
      window.removeEventListener("pageshow", maybeStart);
      document.removeEventListener("visibilitychange", maybeStart);
    };
  }, [waiting, onContinue]);

  function added() {
    if (holdForHomeScreen) {
      setWaiting(true);
      return;
    }
    onContinue();
  }

  async function install() {
    setBusy(true);
    void trackShopperOnboardingEventAction("pwa_install_clicked");
    const result = await promptInstall();
    setBusy(false);
    if (result === "accepted") {
      void trackShopperOnboardingEventAction("pwa_installed");
      added();
      return;
    }
    if (result === "dismissed") {
      void trackShopperOnboardingEventAction("pwa_install_dismissed");
      setPromptGone(true);
      return;
    }
    setPromptGone(true);
  }

  if (waiting) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
            Open FINDIT from your Home Screen
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            Tap the FINDIT icon you just added. That&apos;s where we&apos;ll
            show you how it works and sign you in.
          </p>
        </div>
        <div className="mt-8 space-y-2">
          <Button type="button" size="xl" className="w-full" onClick={onContinue}>
            Start FINDIT
          </Button>
        </div>
      </div>
    );
  }

  if (surface === "ios-safari" || surface === "ios-chrome") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
            Keep FINDIT one tap away
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            {surface === "ios-chrome"
              ? "You’re in Chrome on iPhone. Follow the steps below, or open this page in Safari for the classic Share button."
              : "Add FINDIT to your Home Screen so it opens just like an app."}
          </p>
          <div className="mt-8">
            <AddToHomeGuide surface={surface} productName="FINDIT" />
          </div>
        </div>
        <div className="mt-8 space-y-2">
          <Button type="button" size="xl" className="w-full" onClick={added}>
            I&apos;ve Added FINDIT
          </Button>
          {holdForHomeScreen ? null : (
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className="h-12 w-full"
              onClick={onSkip}
            >
              Do this later
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (surface === "android-prompt" || (surface === "android-manual" && canInstall)) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-ink shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <Share className="h-6 w-6" strokeWidth={2} aria-hidden />
          </span>
          <h1 className="mt-8 text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
            Install FINDIT
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-ink-muted">
            Get faster access and use FINDIT like an app.
          </p>
          {promptGone ? (
            <p className="mt-6 text-sm leading-relaxed text-ink-muted">
              {holdForHomeScreen
                ? "Add FINDIT from your browser menu, then open it from your Home Screen."
                : "You can install FINDIT later from your browser menu, or skip for now."}
            </p>
          ) : null}
        </div>
        <div className="mt-8 space-y-2">
          {!promptGone && (canInstall || surface === "android-prompt") ? (
            <Button
              type="button"
              size="xl"
              className="w-full"
              disabled={busy}
              onClick={() => void install()}
            >
              {busy ? "Installing…" : "Install FINDIT"}
            </Button>
          ) : (
            <Button type="button" size="xl" className="w-full" onClick={added}>
              Continue
            </Button>
          )}
          {holdForHomeScreen ? null : (
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className="h-12 w-full"
              onClick={onSkip}
            >
              Do this later
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (surface === "android-manual") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
            Install FINDIT
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            Get faster access and use FINDIT like an app.
          </p>
          <div className="mt-8">
            <AddToHomeGuide surface={surface} productName="FINDIT" />
          </div>
        </div>
        <div className="mt-8 space-y-2">
          <Button type="button" size="xl" className="w-full" onClick={added}>
            I&apos;ve Added FINDIT
          </Button>
          {holdForHomeScreen ? null : (
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className="h-12 w-full"
              onClick={onSkip}
            >
              Do this later
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl">
          FINDIT works in this browser
        </h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-ink-muted">
          On a phone, you can add FINDIT to your Home Screen for one-tap access.
          You can keep going here.
        </p>
      </div>
      <Button type="button" size="xl" className="mt-8 w-full" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}
