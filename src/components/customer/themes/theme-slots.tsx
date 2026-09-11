"use client";

import dynamic from "next/dynamic";
import { useCustomerThemeId } from "@/components/customer/themes/theme-context";

const PoohHomeGreeting = dynamic(
  () =>
    import("@/components/customer/themes/pooh/home-greeting").then(
      (mod) => mod.PoohHomeGreeting
    ),
  { ssr: true }
);

const PoohProfileBanner = dynamic(
  () =>
    import("@/components/customer/themes/pooh/profile-banner").then(
      (mod) => mod.PoohProfileBanner
    ),
  { ssr: true }
);

const PoohFindHomeBackground = dynamic(
  () =>
    import("@/components/customer/themes/pooh/find-home-background").then(
      (mod) => mod.PoohFindHomeBackground
    ),
  { ssr: true }
);

export function CustomerThemeHomeGreeting({
  firstName,
}: {
  firstName?: string | null;
}) {
  const themeId = useCustomerThemeId();
  if (themeId !== "pooh") return null;
  return <PoohHomeGreeting firstName={firstName} />;
}

export function CustomerThemeProfileBanner({
  firstName,
}: {
  firstName?: string | null;
}) {
  const themeId = useCustomerThemeId();
  if (themeId !== "pooh") return null;
  return <PoohProfileBanner firstName={firstName} />;
}

/** Find home query-step background. Loads theme art only when assigned. */
export function CustomerThemeFindHomeBackground() {
  const themeId = useCustomerThemeId();
  if (themeId !== "pooh") return null;
  return <PoohFindHomeBackground />;
}
