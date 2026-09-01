import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { OTP_RESEND_SECONDS, maskEmail } from "@findit/domain";
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
  const { sendEmailOtp, verifyEmailOtp } = useAuth();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"contact" | "otp">("contact");
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
    setError(
      "This app is for shoppers. The FINDIT operator signs in on the website, then opens /admin."
    );
  }, [reason]);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    const res = await sendEmailOtp({ email, createIfMissing: false });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSentEmail(res.email || email);
    setMasked(res.masked || maskEmail(res.email || email));
    setSeconds(OTP_RESEND_SECONDS);
    setCode("");
    setStep("otp");
  };

  const onOtp = async () => {
    setBusy(true);
    setError(null);
    const res = await verifyEmailOtp({ email: sentEmail || email, token: code });
    if (res.error) setError(res.error);
    setBusy(false);
  };

  return (
    <Screen variant="auth">
      <AuthHeader
        title="Sign in"
        subtitle="We’ll email a 6-digit code. After that, this device stays signed in."
      />

      <GlassCard>
        {!isSupabaseConfigured() && (
          <GlassNotice>
            Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
          </GlassNotice>
        )}
        {step === "contact" ? (
          <>
            <GlassInput
              inset
              last
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Email"
              textContentType="emailAddress"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            {error ? <GlassNotice>{error}</GlassNotice> : null}
            <GlassButton
              title={busy ? "Sending…" : "Email me a code"}
              size="lg"
              loading={busy}
              disabled={busy}
              onPress={() => sendCode()}
              style={styles.cta}
            />
          </>
        ) : (
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
                setStep("contact");
                setCode("");
                setError(null);
              }}
              style={styles.altPress}
            >
              <Text style={[styles.alt, { color: theme.inkMuted }]}>Use a different email</Text>
            </Pressable>
            <Pressable
              disabled={busy || seconds > 0}
              onPress={() => sendCode()}
              style={styles.altPress}
            >
              <Text style={[styles.alt, { color: theme.inkMuted }]}>
                {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
              </Text>
            </Pressable>
          </>
        )}
      </GlassCard>

      <AuthFooter linkHref="/(auth)/signup" linkLabel="Create account" />
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
