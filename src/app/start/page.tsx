"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShopperOnboarding } from "@/components/customer/onboarding/shopper-onboarding";
import { OnboardingShell } from "@/components/customer/onboarding/shell";
import {
  grandfatherShopperOnboardingIfNeeded,
  isShopperOnboardingComplete,
} from "@/lib/customer/onboarding-state";
import { capturePwaInstallEvents } from "@/lib/pwa-install";

export default function StartPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    capturePwaInstallEvents();
    grandfatherShopperOnboardingIfNeeded();
    const complete = isShopperOnboardingComplete();

    void (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          router.replace("/home");
          return;
        }
      } catch {
        // Demo mode or missing keys — keep going.
      }
      if (complete) {
        router.replace("/login");
        return;
      }
      setShow(true);
    })();
  }, [router]);

  if (!show) {
    return (
      <OnboardingShell>
        <div className="flex flex-1 items-center justify-center" aria-busy="true">
          <span className="sr-only">Loading FINDIT</span>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <ShopperOnboarding
      signedIn={false}
      onComplete={() => router.replace("/home")}
    />
  );
}
