import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ColorSchemeName } from "@findit/theme";
import { AppThemeProvider } from "@findit/theme/native";

const KEY = "findit.color-scheme";

type AppearanceState = {
  scheme: ColorSchemeName;
  setScheme: (scheme: ColorSchemeName) => void;
};

const AppearanceContext = createContext<AppearanceState | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorSchemeName>("light");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((value) => {
      if (value === "light" || value === "dark") setSchemeState(value);
    });
  }, []);

  const value = useMemo<AppearanceState>(
    () => ({
      scheme,
      setScheme: (next) => {
        setSchemeState(next);
        AsyncStorage.setItem(KEY, next).catch(() => {});
      },
    }),
    [scheme]
  );

  return (
    <AppearanceContext.Provider value={value}>
      <AppThemeProvider scheme={scheme}>{children}</AppThemeProvider>
    </AppearanceContext.Provider>
  );
}

const fallbackAppearance: AppearanceState = {
  scheme: "light",
  setScheme: () => {},
};

export function useAppearance() {
  return useContext(AppearanceContext) ?? fallbackAppearance;
}
