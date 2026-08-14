import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { spacing, theme, typography } from "@findit/theme";
import {
  GlassBackdrop,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassNotice,
} from "@findit/theme/native";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function LoginScreen() {
  const { signIn, stores, session, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const res = await signIn(email.trim(), password);
    if (res.error) setError(res.error);
    else {
      await refresh();
      // If signed in but no store membership, show message
      setTimeout(() => {
        if (session && stores.length === 0) {
          setError("No active store membership. Ask your owner for an invite.");
        }
      }, 500);
    }
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
          <Text style={styles.brand}>FINDIT Employee</Text>
          <Text style={styles.sub}>Floor terminal — respond fast.</Text>

          <GlassCard level="strong" style={styles.card}>
            {!isSupabaseConfigured() && (
              <GlassNotice tone="muted">
                Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
              </GlassNotice>
            )}
            <GlassInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Work email"
              value={email}
              onChangeText={setEmail}
            />
            <GlassInput
              secureTextEntry
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
            />
            {error ? <GlassNotice tone="accent">{error}</GlassNotice> : null}
            <GlassButton
              title="Sign in"
              variant="accent"
              size="lg"
              loading={busy}
              onPress={onSubmit}
              disabled={busy}
            />
          </GlassCard>

          <Text style={styles.hint}>
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
  brand: {
    color: theme.ink,
    fontSize: typography.size.hero,
    fontWeight: typography.weight.heavy,
    letterSpacing: typography.tracking.hero,
  },
  sub: {
    color: theme.inkMuted,
    fontSize: typography.size.body,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  card: { padding: spacing.xl },
  hint: {
    color: theme.inkSubtle,
    fontSize: typography.size.footnote,
    lineHeight: 20,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
});
