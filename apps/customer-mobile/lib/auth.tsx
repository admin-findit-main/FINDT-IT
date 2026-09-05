import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "@findit/types";
import {
  coerceSoloAdminProfile,
  customerNeedsFirstName,
  isSoloAdminEmail,
  mapEmailOtpError,
  mapPhoneOtpError,
  maskEmail,
  maskPhoneE164,
  normalizeEmail,
  normalizePhoneToE164,
  PHONE_OTP_DISABLED_MESSAGE,
  PHONE_OTP_ENABLED,
} from "@findit/domain";
import { supabase, isSupabaseConfigured } from "./supabase";
import { captureException } from "./monitoring";

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (input: {
    email: string;
    password: string;
    firstName: string;
  }) => Promise<{ error?: string; needsEmailConfirm?: boolean }>;
  sendPhoneOtp: (input: {
    phone: string;
    createIfMissing: boolean;
  }) => Promise<{ error?: string; phone?: string; masked?: string }>;
  verifyPhoneOtp: (input: {
    phone: string;
    token: string;
  }) => Promise<{ error?: string; needsName?: boolean }>;
  sendEmailOtp: (input: {
    email: string;
    createIfMissing: boolean;
  }) => Promise<{ error?: string; email?: string; masked?: string }>;
  verifyEmailOtp: (input: {
    email: string;
    token: string;
  }) => Promise<{ error?: string; needsName?: boolean }>;
  completeFirstName: (firstName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (user: { id: string; email?: string | null }) => {
    for (let i = 0; i < 8; i++) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        captureException(error, { where: "loadProfile" });
        setProfile(null);
        return;
      }
      if (data) {
        setProfile(coerceSoloAdminProfile(data as Profile, user.email) as Profile);
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    setProfile(null);
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
        loadProfile(data.session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        loadProfile(next.user);
      } else {
        setProfile(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn: async (email, password) => {
        if (isSoloAdminEmail(email)) {
          return {
            error:
              "This app is for shoppers. Sign in on the FINDIT website, then open /admin.",
          };
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) return {};
        const text = error.message.toLowerCase();
        if (text.includes("email not confirmed")) {
          return {
            error:
              "Confirm the email we sent, then sign in here. Don't tap the link twice.",
          };
        }
        if (text.includes("invalid") && text.includes("credential")) {
          return {
            error:
              "Wrong email or password. If you just joined, sign in here with that password — the email link cannot open this app.",
          };
        }
        return { error: error.message };
      },
      signUp: async ({ email, password, firstName }) => {
        if (isSoloAdminEmail(email)) {
          return {
            error:
              "This app is for shoppers. Sign in on the FINDIT website, then open /admin.",
          };
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: firstName, account_type: "customer" },
          },
        });
        if (error) return { error: error.message };
        if (data.user && (data.user.identities?.length ?? 1) === 0) {
          return {
            error:
              "That email already has an account. Go back to askfindit.com.",
          };
        }
        if (data.user) {
          await supabase
            .from("profiles")
            .update({
              first_name: firstName,
              display_name: firstName,
            })
            .eq("id", data.user.id);
        }
        if (!data.session) return { needsEmailConfirm: true };
        return {};
      },
      sendPhoneOtp: async ({ phone, createIfMissing }) => {
        if (!PHONE_OTP_ENABLED) return { error: PHONE_OTP_DISABLED_MESSAGE };
        const parsed = normalizePhoneToE164(phone);
        if (!parsed.ok) return { error: parsed.error };
        const { error } = await supabase.auth.signInWithOtp({
          phone: parsed.e164,
          options: {
            shouldCreateUser: createIfMissing,
            channel: "sms",
            data: { account_type: "customer" },
          },
        });
        if (error) return { error: mapPhoneOtpError(error.message, "send") };
        return { phone: parsed.e164, masked: maskPhoneE164(parsed.e164) };
      },
      verifyPhoneOtp: async ({ phone, token }) => {
        if (!PHONE_OTP_ENABLED) return { error: PHONE_OTP_DISABLED_MESSAGE };
        const parsed = normalizePhoneToE164(phone);
        if (!parsed.ok) return { error: parsed.error };
        const code = token.replace(/\D/g, "");
        if (code.length !== 6) return { error: "Enter the 6-digit code." };
        const { data, error } = await supabase.auth.verifyOtp({
          phone: parsed.e164,
          token: code,
          type: "sms",
        });
        if (error) return { error: mapPhoneOtpError(error.message, "verify") };
        const user = data.user;
        if (!user) return { error: "Could not start your session. Try again." };
        await loadProfile(user);
        const { data: row } = await supabase
          .from("profiles")
          .select("first_name, account_type, email")
          .eq("id", user.id)
          .maybeSingle();
        // The fallback carries the same keys as the selected row so the
        // argument is one shape, not a union missing `first_name`.
        const coerced = coerceSoloAdminProfile(
          row || {
            first_name: null,
            account_type: null,
            email: user.email ?? null,
          },
          user.email
        );
        return { needsName: customerNeedsFirstName(coerced) };
      },
      sendEmailOtp: async ({ email, createIfMissing }) => {
        const parsed = normalizeEmail(email);
        if (!parsed.ok) return { error: parsed.error };
        if (isSoloAdminEmail(parsed.email)) {
          return {
            error:
              "This app is for shoppers. Sign in on the FINDIT website, then open /admin.",
          };
        }
        const { error } = await supabase.auth.signInWithOtp({
          email: parsed.email,
          options: {
            shouldCreateUser: createIfMissing,
            data: { account_type: "customer" },
          },
        });
        if (error) return { error: mapEmailOtpError(error.message, "send") };
        return { email: parsed.email, masked: maskEmail(parsed.email) };
      },
      verifyEmailOtp: async ({ email, token }) => {
        const parsed = normalizeEmail(email);
        if (!parsed.ok) return { error: parsed.error };
        const code = token.replace(/\D/g, "");
        if (code.length !== 6) return { error: "Enter the 6-digit code." };
        const { data, error } = await supabase.auth.verifyOtp({
          email: parsed.email,
          token: code,
          type: "email",
        });
        if (error) return { error: mapEmailOtpError(error.message, "verify") };
        const user = data.user;
        if (!user) return { error: "Could not start your session. Try again." };
        await loadProfile(user);
        const { data: row } = await supabase
          .from("profiles")
          .select("first_name, account_type, email")
          .eq("id", user.id)
          .maybeSingle();
        // The fallback carries the same keys as the selected row so the
        // argument is one shape, not a union missing `first_name`.
        const coerced = coerceSoloAdminProfile(
          row || {
            first_name: null,
            account_type: null,
            email: user.email ?? null,
          },
          user.email
        );
        return { needsName: customerNeedsFirstName(coerced) };
      },
      completeFirstName: async (firstName) => {
        const name = firstName.trim();
        if (!name) return { error: "What's your first name?" };
        if (name.length > 60) return { error: "Use a shorter first name." };
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return { error: "Please sign in first." };
        const { error } = await supabase
          .from("profiles")
          .update({ first_name: name, display_name: name })
          .eq("id", user.id);
        if (error) return { error: error.message };
        await loadProfile(user);
        return {};
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
      refreshProfile: async () => {
        if (session?.user) await loadProfile(session.user);
      },
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requires AuthProvider");
  return ctx;
}
