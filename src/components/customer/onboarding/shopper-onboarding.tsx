"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  browserNotifyPermission,
  type BrowserNotifyPermission,
} from "@/lib/browser-notify";
import {
  WEB_NOTIFY_PROMPT_DISMISS_KEY,
  markShopperOnboardingComplete,
  shopperOnboardingSteps,
  writeShopperOnboardingState,
  type ShopperOnboardingStepId,
} from "@/lib/customer/onboarding-state";
import {
  getInstallSurface,
  isIosDevice,
  isStandaloneDisplay,
} from "@/lib/pwa";
import { usePwaInstall } from "@/lib/pwa-install";
import { trackShopperOnboardingEventAction } from "@/lib/services/onboarding-actions";
import { HowItWorksStep } from "./how-it-works-step";
import { InstallStep } from "./install-step";
import { LocationStep } from "./location-step";
import { NotificationsStep } from "./notifications-step";
import { ReadyStep } from "./ready-step";
import { OnboardingEnter, OnboardingProgress, OnboardingShell } from "./shell";
import { WelcomeStep } from "./welcome-step";
import { useCustomerProfile } from "@/components/customer/session";
import { getConsumerEntitlements } from "@/lib/config/constants";
import { isCompleteShortPlace, shortPlaceFromProfile } from "@findit/domain";

function markNotifyPromptDismissed() {
  try {
    localStorage.setItem(WEB_NOTIFY_PROMPT_DISMISS_KEY, "1");
  } catch {
    // Private mode.
  }
}

export function ShopperOnboarding({ onComplete }: { onComplete: () => void }) {
  const profile = useCustomerProfile();
  const entitlements = getConsumerEntitlements(profile?.subscription_plan);
  const { canInstall } = usePwaInstall();
  const [permission, setPermission] = useState<BrowserNotifyPermission>("default");
  const [standalone, setStandalone] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [index, setIndex] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    setPermission(browserNotifyPermission());
    setStandalone(isStandaloneDisplay());
    setHydrated(true);
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
      }),
    [standalone, permission, needsLocation]
  );

  const step = steps[Math.min(index, steps.length - 1)] ?? "welcome";
  const dotsTotal = Math.max(steps.length - 1, 1);
  const dotsIndex = Math.min(index, dotsTotal - 1);
  const showDots = step !== "ready";
  const iosNeedsHomeScreen = isIosDevice() && !standalone;
  const surface = getInstallSurface(canInstall);

  function goNext() {
    setIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  function finishInstall(skipped: boolean) {
    writeShopperOnboardingState({
      installEducationSeen: true,
      installSkipped: skipped,
    });
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

  function finish() {
    markShopperOnboardingComplete();
    writeShopperOnboardingState({ notificationEducationSeen: true });
    void trackShopperOnboardingEventAction("onboarding_completed");
    onComplete();
  }

  if (!hydrated) {
    return <OnboardingShell />;
  }

  return (
    <OnboardingShell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex h-10 items-center justify-center">
          {showDots ? <OnboardingProgress index={dotsIndex} total={dotsTotal} /> : null}
        </div>
        <OnboardingEnter stepKey={step}>
          {step === "welcome" ? <WelcomeStep onNext={goNext} /> : null}
          {step === "how" ? <HowItWorksStep onNext={goNext} /> : null}
          {step === "install" ? (
            <InstallStep
              surface={surface}
              onContinue={() => finishInstall(false)}
              onSkip={() => finishInstall(true)}
            />
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

export type { ShopperOnboardingStepId };
