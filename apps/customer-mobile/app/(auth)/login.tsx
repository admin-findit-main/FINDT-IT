import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import {
  OTP_RESEND_SECONDS,
  formatUsNationalInput,
  maskPhoneE164,
} from "@findit/domain";
import { spacing, typography } from "@findit/theme";
import {
  GlassButton,
  GlassCard,
  GlassInput,
  GlassNotice,
  useAppTheme,
} from "@findit/theme/native";
import { AuthFooter, AuthHeader } from "@/components/auth-chrome";
import { Screen } from "@/components/screen";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function LoginScreen() {
  const theme = useAppTheme();
  const { sendPhoneOtp, verifyPhoneOtp, signIn } = useAuth();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [mode, setMode] = useState<"phone" | "email">("email");
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  useEffect(() => {
    if (reason !== "customer-only") return;
    setMode("email");
    setError(
      "This app is for shoppers. The FINDIT operator signs in on the website, then opens /admin."
    );
  }, [reason]);

  const sendCode = async (value: string) => {
    setBusy(true);
    setError(null);
    const res = await sendPhoneOtp({ phone: value, createIfMissing: false });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setPhoneE164(res.phone || value);
    setMasked(res.masked || maskPhoneE164(res.phone || value));
    setSeconds(OTP_RESEND_SECONDS);
    setCode("");
    setStep("otp");
  };

  const onOtp = async () => {
    setBusy(true);
    setError(null);
    const res = await verifyPhoneOtp({
      phone: phoneE164 || phoneDisplay,
      token: code,
    });
    if (res.error) setError(res.error);
    setBusy(false);
  };

  const onEmail = async () => {
    setBusy(true);
    setError(null);
    const res = await signIn(email.trim(), password);
    if (res.error) setError(res.error);
    setBusy(false);
  };

  return (
    <Screen variant="auth">
      <AuthHeader title="Sign in" subtitle="Ask nearby stores who has it." />

      <GlassCard>
        {!isSupabaseConfigured() && (
          <GlassNotice>
            Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
          </GlassNotice>
        )}
        {mode === "phone" && step === "phone" ? (
          <>
            <GlassInput
              inset
              last
              keyboardType="phone-pad"
              placeholder="Phone number"
              textContentType="telephoneNumber"
              autoComplete="tel"
              value={phoneDisplay}
              onChangeText={(raw) => {
                if (raw.trim().startsWith("+") && raw.replace(/\D/g, "").length > 11) {
                  setPhoneDisplay(raw);
                  return;
                }
                setPhoneDisplay(formatUsNationalInput(raw));
              }}
            />
            {error ? <GlassNotice>{error}</GlassNotice> : null}
            <GlassButton
              title={busy ? "Sending…" : "Text me a code"}
              size="lg"
              loading={busy}
              disabled={busy}
              onPress={() => sendCode(phoneDisplay)}
              style={styles.cta}
            />
          </>
        ) : null}
        {mode === "phone" && step === "otp" ? (
          <>
            <Text style={[styles.hint, { color: theme.inkMuted }]}>Code sent to {masked}</Text>
            <GlassInput
              inset
              last
              keyboardType="number-pad"
              placeholder="6-digit code"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              value={code}
              maxLength={6}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            />
            {error ? <GlassNotice>{error}</GlassNotice> : null}
            <GlassButton
              title={busy ? "Checking…" : "Continue"}
              size="lg"
              loading={busy}
              disabled={busy || code.length !== 6}
              onPress={onOtp}
              style={styles.cta}
            />
            <Pressable
              onPress={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
              style={styles.altPress}
            >
              <Text style={[styles.alt, { color: theme.inkMuted }]}>Use a different number</Text>
            </Pressable>
            <Pressable
              disabled={busy || seconds > 0}
              onPress={() => sendCode(phoneE164 || phoneDisplay)}
              style={styles.altPress}
            >
              <Text style={[styles.alt, { color: theme.inkMuted }]}>
                {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
              </Text>
            </Pressable>
          </>
        ) : null}
        {mode === "email" ? (
          <>
            <GlassInput
              inset
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
            />
            <GlassInput
              inset
              last
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
            />
            {error ? <GlassNotice>{error}</GlassNotice> : null}
            <GlassButton
              title="Sign in"
              size="lg"
              loading={busy}
              disabled={busy}
              onPress={onEmail}
              style={styles.cta}
            />
          </>
        ) : null}
      </GlassCard>

      <AuthFooter
        secondaryLabel={mode === "phone" ? "Use email" : "Use phone"}
        onSecondary={() => {
          setMode(mode === "phone" ? "email" : "phone");
          setError(null);
          setStep("phone");
        }}
        linkHref="/(auth)/signup"
        linkLabel="Create account"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: typography.size.footnote,
    marginBottom: spacing.sm,
  },
  cta: { marginTop: spacing.lg },
  altPress: { minHeight: 44, justifyContent: "center", marginTop: spacing.md },
  alt: {
    fontSize: typography.size.footnote,
    textAlign: "center",
  },
});
