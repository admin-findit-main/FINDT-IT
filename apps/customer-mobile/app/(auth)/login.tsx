import { Link } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
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
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const res = await signIn(email.trim(), password);
    if (res.error) setError(res.error);
    setBusy(false);
  };

  return (
    <GlassBackdrop>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>FINDIT</Text>
        <Text style={styles.sub}>Ask nearby stores who has it.</Text>

        <GlassCard level="subtle">
          {!isSupabaseConfigured() && (
            <GlassNotice>
              Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
            </GlassNotice>
          )}
          <GlassInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
          />
          <GlassInput
            secureTextEntry
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            containerStyle={styles.lastField}
          />
          {error ? <GlassNotice>{error}</GlassNotice> : null}
          <GlassButton title="Sign in" size="lg" loading={busy} disabled={busy} onPress={onSubmit} />
        </GlassCard>

        <Link href="/(auth)/signup" style={styles.link}>
          Create customer account
        </Link>
      </ScrollView>
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  brand: {
    fontSize: typography.size.hero,
    fontWeight: typography.weight.heavy,
    color: theme.ink,
    letterSpacing: typography.tracking.hero,
  },
  sub: {
    color: theme.inkMuted,
    fontSize: typography.size.body,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  lastField: { marginBottom: spacing.lg },
  link: {
    color: theme.accentInk,
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    textAlign: "center",
  },
});
