import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { OTP_RESEND_SECONDS, maskEmail } from "@findit/domain";
import { spacing, theme, typography } from "@findit/theme";
import {
  GlassBackdrop,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassNotice,
} from "@findit/theme/native";
import { BrandBusiness } from "@/components/brand";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function LoginScreen() {
  const { sendEmailOtp, verifyEmailOtp, stores, session, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    const res = await sendEmailOtp({ email: email.trim() });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSentEmail(res.email || email.trim());
    setMasked(res.masked || maskEmail(res.email || email.trim()));
    setSeconds(OTP_RESEND_SECONDS);
    setCode("");
    setStep("otp");
  };

  const onOtp = async () => {
    setBusy(true);
    setError(null);
    const res = await verifyEmailOtp({
      email: sentEmail || email.trim(),
      token: code,
    });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    await refresh();
    setTimeout(() => {
      if (session && stores.length === 0) {
        setError("No active store membership. Ask your owner for an invite.");
      }
    }, 500);
    setBusy(false);
  };

  return (
    <GlassBackdrop>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <BrandBusiness style={styles.brandImg} />
          <Text style={styles.sub}>
            We’ll email a 6-digit code. After that, this device stays signed in.
          </Text>

          <GlassCard level="strong" style={styles.card}>
            {!isSupabaseConfigured() && (
              <GlassNotice tone="muted">
                Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
              </GlassNotice>
            )}
            {step === "email" ? (
              <>
                <GlassInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Work email"
                  textContentType="emailAddress"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                />
                {error ? <GlassNotice tone="accent">{error}</GlassNotice> : null}
                <GlassButton
                  title={busy ? "Sending…" : "Email me a code"}
                  variant="accent"
                  size="lg"
                  loading={busy}
                  onPress={sendCode}
                  disabled={busy}
                />
              </>
            ) : (
              <>
                <Text style={styles.hint}>Code sent to {masked}</Text>
                <GlassInput
                  keyboardType="number-pad"
                  placeholder="6-digit code"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  value={code}
                  maxLength={6}
                  onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                />
                {error ? <GlassNotice tone="accent">{error}</GlassNotice> : null}
                <GlassButton
                  title={busy ? "Checking…" : "Sign in"}
                  variant="accent"
                  size="lg"
                  loading={busy}
                  onPress={onOtp}
                  disabled={busy || code.length !== 6}
                />
                <Pressable
                  onPress={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                  }}
                  style={styles.altPress}
                >
                  <Text style={styles.alt}>Use a different email</Text>
                </Pressable>
                <Pressable
                  disabled={busy || seconds > 0}
                  onPress={sendCode}
                  style={styles.altPress}
                >
                  <Text style={styles.alt}>
                    {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
                  </Text>
                </Pressable>
              </>
            )}
          </GlassCard>

          <Text style={styles.hintFooter}>
            Owners manage team, demand, and settings on the FINDIT web app.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  brandImg: {
    height: 28,
    width: 180,
    marginBottom: spacing.sm,
  },
  sub: {
    color: theme.inkMuted,
    fontSize: typography.size.body,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  card: { padding: spacing.xl },
  hint: {
    color: theme.inkMuted,
    fontSize: typography.size.footnote,
    marginBottom: spacing.sm,
  },
  altPress: { minHeight: 44, justifyContent: "center", marginTop: spacing.md },
  alt: {
    color: theme.inkMuted,
    fontSize: typography.size.footnote,
    textAlign: "center",
  },
  hintFooter: {
    color: theme.inkSubtle,
    fontSize: typography.size.footnote,
    lineHeight: 20,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
});
