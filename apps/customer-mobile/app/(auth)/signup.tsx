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

export default function SignupScreen() {
  const theme = useAppTheme();
  const { sendPhoneOtp, verifyPhoneOtp } = useAuth();
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const sendCode = async (value: string) => {
    setBusy(true);
    setError(null);
    const res = await sendPhoneOtp({ phone: value, createIfMissing: true });
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

  return (
    <Screen variant="auth">
      <AuthHeader
        title="Create account"
        subtitle="We’ll text a 6-digit code. No email or password."
      />

      <GlassCard>
        {step === "phone" ? (
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
        )}
      </GlassCard>

      <AuthFooter linkHref="/(auth)/login" linkLabel="Already have an account?" />
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
