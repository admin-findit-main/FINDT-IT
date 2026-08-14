import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createMobileClient } from "@findit/supabase-client/mobile";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** SecureStore is native-only; web/SSR stubs crash if called. */
const useSecureStore = Platform.OS !== "web";

const authStorage = {
  getItem: (key: string) =>
    useSecureStore ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key),
  setItem: (key: string, value: string) =>
    useSecureStore
      ? SecureStore.setItemAsync(key, value)
      : AsyncStorage.setItem(key, value),
  removeItem: (key: string) =>
    useSecureStore
      ? SecureStore.deleteItemAsync(key)
      : AsyncStorage.removeItem(key),
};

export const supabase = createMobileClient({
  supabaseUrl: url || "https://placeholder.supabase.co",
  supabaseAnonKey: anon || "placeholder-anon-key",
  storage: authStorage,
});

export function isSupabaseConfigured() {
  return Boolean(url && anon);
}
