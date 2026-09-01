import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile, Store, StoreMemberRole } from "@findit/types";
import { coerceSoloAdminProfile, isSoloAdminEmail, mapEmailOtpError, maskEmail, normalizeEmail } from "@findit/domain";
import { supabase, isSupabaseConfigured } from "./supabase";
import { captureException } from "./monitoring";

export type StoreMembership = Store & { role: StoreMemberRole };

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  stores: StoreMembership[];
  activeStore: StoreMembership | null;
  setActiveStoreId: (id: string) => void;
  loading: boolean;
  sendEmailOtp: (input: {
    email: string;
  }) => Promise<{ error?: string; email?: string; masked?: string }>;
  verifyEmailOtp: (input: {
    email: string;
    token: string;
  }) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stores, setStores] = useState<StoreMembership[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWorkspace = async (user: { id: string; email?: string | null }) => {
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (pErr) captureException(pErr, { where: "loadProfile" });
    setProfile(
      prof ? (coerceSoloAdminProfile(prof as Profile, user.email) as Profile) : null
    );

    const { data: members, error: mErr } = await supabase
      .from("store_members")
      .select("role, store:stores(*)")
      .eq("user_id", user.id)
      .eq("status", "active");
    if (mErr) {
      captureException(mErr, { where: "loadMembers" });
      setStores([]);
      return;
    }
    const list = (members || [])
      .map((m: { role: StoreMemberRole; store: Store | Store[] | null }) => {
        const store = Array.isArray(m.store) ? m.store[0] : m.store;
        if (!store) return null;
        return { ...store, role: m.role };
      })
      .filter(Boolean) as StoreMembership[];
    setStores(list);
    setActiveStoreId((prev) => prev || list[0]?.id || null);
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        loadWorkspace(data.session.user).finally(() => setLoading(false));
      } else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => {
      setSession(next);
      if (next?.user) loadWorkspace(next.user);
      else {
        setProfile(null);
        setStores([]);
        setActiveStoreId(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0] || null;

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      stores,
      activeStore,
      setActiveStoreId,
      loading,
      sendEmailOtp: async ({ email }) => {
        const parsed = normalizeEmail(email);
        if (!parsed.ok) return { error: parsed.error };
        if (isSoloAdminEmail(parsed.email)) {
          return {
            error:
              "Operator accounts use the FINDIT website at /admin, not the store app.",
          };
        }
        const { error } = await supabase.auth.signInWithOtp({
          email: parsed.email,
          options: { shouldCreateUser: false },
        });
        if (error) return { error: mapEmailOtpError(error.message, "send") };
        return { email: parsed.email, masked: maskEmail(parsed.email) };
      },
      verifyEmailOtp: async ({ email, token }) => {
        const parsed = normalizeEmail(email);
        if (!parsed.ok) return { error: parsed.error };
        const code = token.replace(/\D/g, "");
        if (code.length !== 6) return { error: "Enter the 6-digit code." };
        const { error } = await supabase.auth.verifyOtp({
          email: parsed.email,
          token: code,
          type: "email",
        });
        return error ? { error: mapEmailOtpError(error.message, "verify") } : {};
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refresh: async () => {
        if (session?.user) await loadWorkspace(session.user);
      },
    }),
    [session, profile, stores, activeStore, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
