"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShopperOnboarding } from "@/components/customer/onboarding/shopper-onboarding";
import {
  grandfatherShopperOnboardingIfNeeded,
  isShopperOnboardingComplete,
} from "@/lib/customer/onboarding-state";
import { capturePwaInstallEvents } from "@/lib/pwa-install";
import { AppScreenLoader } from "@/components/shared/load-progress";

function sessionHasShopperCache(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("findit-cache-v1:")) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function isShopperHome(pathname: string): boolean {
  return pathname === "/home" || pathname === "/";
}

export function ShopperOnboardingGate({
  accountType,
  children,
}: {
  accountType: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    capturePwaInstallEvents();
    if (accountType !== "customer") {
      setShow(false);
      setReady(true);
      return;
    }
    let sessionHasCache = sessionHasShopperCache();
    try {
      sessionHasCache =
        sessionHasCache || Boolean(sessionStorage.getItem("findit:pending-find"));
    } catch {
      // Private mode.
    }
    grandfatherShopperOnboardingIfNeeded(undefined, {
      sessionHasCache,
    });
    const complete = isShopperOnboardingComplete();
    setShow(!complete && isShopperHome(pathname));
    setReady(true);
  }, [accountType, pathname]);

  if (!ready) {
    return <AppScreenLoader />;
  }

  if (show) {
    return <ShopperOnboarding signedIn onComplete={() => setShow(false)} />;
  }

  return children;
}
