import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@findit/types";

export type MobileClientOptions = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /**
   * SecureStore-like adapter. Pass Expo SecureStore methods.
   * Falls back to in-memory if omitted (dev only).
   */
  storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
  };
};

const memory = new Map<string, string>();
const memoryStorage = {
  getItem: async (key: string) => memory.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: async (key: string) => {
    memory.delete(key);
  },
};

/**
 * Anon Supabase client for React Native / Expo.
 * NEVER pass the service role key here.
 */
export function createMobileClient(
  options: MobileClientOptions
): SupabaseClient<Database> {
  if (!options.supabaseUrl || !options.supabaseAnonKey) {
    throw new Error(
      "Missing Supabase URL or anon key. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  if (
    options.supabaseAnonKey.includes("service_role") ||
    options.supabaseAnonKey.length > 500
  ) {
    // Heuristic guard — refuse obviously wrong keys
    console.warn(
      "[findit] Refusing to create mobile client with a suspicious key. Use the anon/publishable key only."
    );
  }

  const storage = options.storage ?? memoryStorage;

  return createClient<Database>(options.supabaseUrl, options.supabaseAnonKey, {
    auth: {
      storage: {
        getItem: storage.getItem,
        setItem: storage.setItem,
        removeItem: storage.removeItem,
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
