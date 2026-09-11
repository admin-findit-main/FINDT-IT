"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { CustomerThemeId } from "@/lib/customer-themes";
import { normalizeCustomerThemeId } from "@/lib/customer-themes";

const CustomerThemeContext = createContext<CustomerThemeId>("default");

export function CustomerThemeProvider({
  themeId,
  children,
}: {
  themeId: string | null | undefined;
  children: ReactNode;
}) {
  const id = normalizeCustomerThemeId(themeId);
  return (
    <CustomerThemeContext.Provider value={id}>
      {children}
    </CustomerThemeContext.Provider>
  );
}

export function useCustomerThemeId(): CustomerThemeId {
  return useContext(CustomerThemeContext);
}
