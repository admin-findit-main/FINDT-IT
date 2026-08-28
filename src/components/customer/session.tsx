"use client";

import { createContext, useContext } from "react";
import type { Profile } from "@/types/database";

const CustomerSessionContext = createContext<Profile | null>(null);

export function CustomerSessionProvider({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <CustomerSessionContext.Provider value={profile}>
      {children}
    </CustomerSessionContext.Provider>
  );
}

export function useCustomerProfile() {
  return useContext(CustomerSessionContext);
}
