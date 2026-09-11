"use client";

import { usePathname } from "next/navigation";
import type { AccountType } from "@/types/database";
import { CustomerTopBar } from "@/components/customer/app-menu";
import { CustomerAlertListener } from "@/components/customer/alert-listener";
import { WebPushRegistrar } from "@/components/customer/web-push-registrar";
import { ShopperOnboardingGate } from "@/components/customer/shopper-onboarding-gate";

export function CustomerChrome({
  userId,
  accountType,
  children,
}: {
  userId: string;
  accountType: AccountType | string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const path = (pathname || "").replace(/\/$/, "") || "/";
  const immersiveMap = path === "/map";

  return (
    <ShopperOnboardingGate accountType={accountType ?? ""}>
      <div
        className={
          immersiveMap
            ? "min-h-dvh overflow-hidden bg-canvas"
            : "app-canvas min-h-dvh overflow-x-clip"
        }
      >
        <CustomerAlertListener userId={userId} />
        <WebPushRegistrar />
        {immersiveMap ? null : <CustomerTopBar />}
        <div
          className={
            immersiveMap
              ? "h-dvh w-full"
              : "mx-auto min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] w-full max-w-3xl pb-[env(safe-area-inset-bottom)]"
          }
        >
          {children}
        </div>
      </div>
    </ShopperOnboardingGate>
  );
}
