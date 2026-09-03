"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  browserNotifyPermission,
  type BrowserNotifyPermission,
} from "@/lib/browser-notify";
import {
  WEB_NOTIFY_PROMPT_DISMISS_KEY,
  markShopperOnboardingComplete,
  readShopperOnboardingState,
  shopperOnboardingSteps,
  writeShopperOnboardingState,
} from "@/lib/customer/onboarding-state";
import {
  getInstallSurface,
  isIosDevice,
  isStandaloneDisplay,
  shouldHoldForHomeScreen,
} from "@/lib/pwa";
import { usePwaInstall } from "@/lib/pwa-install";
import { trackShopperOnboardingEventAction } from "@/lib/services/onboarding-actions";
import { AccountStep } from "./account-step";
import { HowItWorksStep } from "./how-it-works-step";
import { InstallStep } from "./install-step";
import { LocationStep } from "./location-step";
import { NotificationsStep } from "./notifications-step";
import { ReadyStep } from "./ready-step";
import { OnboardingEnter, OnboardingProgress, OnboardingShell } from "./shell";
import { WelcomeStep } from "./welcome-step";
import { useCustomerProfile } from "@/components/customer/session";
import { AppScreenLoader } from "@/components/shared/load-progress";
import { getConsumerEntitlements } from "@/lib/config/constants";
import { isCompleteShortPlace, shortPlaceFromProfile } from "@findit/domain";
import { useSurfaceHref } from "@/components/host/host-surface";

function markNotifyPromptDismissed() {
  try {
    localStorage.setItem(WEB_NOTIFY_PROMPT_DISMISS_KEY, "1");
  } catch {
    // Private mode.
  }
}

export function ShopperOnboarding({
  signedIn = true,
  onComplete,
}: {
  signedIn?: boolean;
  onComplete: () => void;
}) {
  const profile = useCustomerProfile();
  const loginHref = useSurfaceHref("dashboard", "/login");
  const entitlements = getConsumerEntitlements(profile?.subscription_plan);
  const { canInstall } = usePwaInstall();
  const [permission, setPermission] = useState<BrowserNotifyPermission>("default");
  const [standalone, setStandalone] = useState(false);
  const [holdForHomeScreen, setHoldForHomeScreen] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [index, setIndex] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    function refreshDisplay() {
      setStandalone(isStandaloneDisplay());
      setHoldForHomeScreen(shouldHoldForHomeScreen());
    }
    setPermission(browserNotifyPermission());
    refreshDisplay();
    setIntroSeen(readShopperOnboardingState().introSeen);
    setHydrated(true);
    window.addEventListener("pageshow", refreshDisplay);
    document.addEventListener("visibilitychange", refreshDisplay);
    return () => {
      window.removeEventListener("pageshow", refreshDisplay);
      document.removeEventListener("visibilitychange", refreshDisplay);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    void trackShopperOnboardingEventAction("onboarding_started");
  }, [hydrated]);

  const needsLocation = !isCompleteShortPlace(
    shortPlaceFromProfile(profile || {})
  );

  const steps = useMemo(
    () =>
      shopperOnboardingSteps({
        standalone,
        notification: permission,
        needsLocation,
        introSeen,
        signedIn,
      }),
    [standalone, permission, needsLocation, introSeen, signedIn]
  );

  const step = steps[Math.min(index, steps.length - 1)] ?? "welcome";
  const dotsTotal = Math.max(steps.length - 1, 1);
  const dotsIndex = Math.min(index, dotsTotal - 1);
  const showDots = step !== "ready" && step !== "install";
  const iosNeedsHomeScreen = isIosDevice() && !standalone;
  const surface = getInstallSurface(canInstall);

  function goNext() {
    setIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  function markIntroSeen() {
    writeShopperOnboardingState({ introSeen: true });
    setIntroSeen(true);
  }

  function finishInstall(skipped: boolean) {
    writeShopperOnboardingState({
      installEducationSeen: true,
      installSkipped: skipped,
    });
    goNext();
  }

  function finishHow() {
    goNext();
  }

  function finishLocation() {
    writeShopperOnboardingState({ locationEducationSeen: true });
    goNext();
  }

  function finishNotify() {
    writeShopperOnboardingState({ notificationEducationSeen: true });
    markNotifyPromptDismissed();
    goNext();
  }

  function finishAccount() {
    markIntroSeen();
    onComplete();
  }

  function finish() {
    markShopperOnboardingComplete();
    writeShopperOnboardingState({
      notificationEducationSeen: true,
      introSeen: true,
    });
    void trackShopperOnboardingEventAction("onboarding_completed");
    onComplete();
  }

  if (!hydrated) {
    return <AppScreenLoader />;
  }

  return (
    <OnboardingShell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex h-10 items-center justify-center">
          {showDots ? <OnboardingProgress index={dotsIndex} total={dotsTotal} /> : null}
        </div>
        <OnboardingEnter stepKey={step}>
          {step === "install" ? (
            <InstallStep
              surface={surface}
              holdForHomeScreen={holdForHomeScreen}
              onContinue={() => finishInstall(false)}
              onSkip={() => finishInstall(true)}
            />
          ) : null}
          {step === "welcome" ? (
            <WelcomeStep
              onNext={goNext}
              loginHref={loginHref}
              onLogin={() => {
                writeShopperOnboardingState({
                  introSeen: true,
                  installEducationSeen: true,
                });
              }}
            />
          ) : null}
          {step === "how" ? <HowItWorksStep onNext={finishHow} /> : null}
          {step === "account" ? (
            <AccountStep loginHref={loginHref} onFinished={finishAccount} />
          ) : null}
          {step === "location" ? (
            <LocationStep onContinue={finishLocation} />
          ) : null}
          {step === "notify" ? (
            <NotificationsStep
              permission={permission}
              iosNeedsHomeScreen={iosNeedsHomeScreen}
              onContinue={finishNotify}
            />
          ) : null}
          {step === "ready" ? (
            <ReadyStep
              planName={entitlements.brandName}
              monthlyFinds={entitlements.monthlyRequestLimit}
              maxMiles={entitlements.maxSearchRadiusMiles}
              onFinish={finish}
            />
          ) : null}
        </OnboardingEnter>
      </div>
    </OnboardingShell>
  );
}
