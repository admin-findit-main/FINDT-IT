"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import {
  CustomerThemeProvider,
  useCustomerThemeId,
} from "@/components/customer/themes/theme-context";
import { isSpecialCustomerTheme } from "@/lib/customer-themes";

const PoohThemeShell = dynamic(
  () =>
    import("@/components/customer/themes/pooh/shell").then(
      (mod) => mod.PoohThemeShell
    ),
  { ssr: true }
);

function ThemeShellGate({ children }: { children: ReactNode }) {
  const themeId = useCustomerThemeId();
  if (!isSpecialCustomerTheme(themeId)) {
    return <>{children}</>;
  }
  if (themeId === "pooh") {
    return <PoohThemeShell>{children}</PoohThemeShell>;
  }
  return <>{children}</>;
}

/** Wraps customer chrome. Special theme chunks load only when assigned. */
export function CustomerThemeRoot({
  themeId,
  children,
}: {
  themeId: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <CustomerThemeProvider themeId={themeId}>
      <ThemeShellGate>{children}</ThemeShellGate>
    </CustomerThemeProvider>
  );
}
