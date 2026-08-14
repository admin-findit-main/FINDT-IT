import { Link, useRouter } from "expo-router";
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

export default function SignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const res = await signUp({
      email: email.trim(),
      password,
      firstName: firstName.trim() || "Friend",
    });
    if (res.error) setError(res.error);
    else router.replace("/(auth)/login");
    setBusy(false);
  };

  return (
    <GlassBackdrop>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>Join FINDIT</Text>
        <Text style={styles.sub}>Customer accounts only in this app.</Text>

        <GlassCard level="subtle">
          <GlassInput
            placeholder="First name"
            value={firstName}
            onChangeText={setFirstName}
          />
          <GlassInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
          />
          <GlassInput
            secureTextEntry
            placeholder="Password (8+ characters)"
            value={password}
            onChangeText={setPassword}
            containerStyle={styles.lastField}
          />
          {error ? <GlassNotice>{error}</GlassNotice> : null}
          <GlassButton
            title="Create account"
            size="lg"
            loading={busy}
            disabled={busy}
            onPress={onSubmit}
          />
        </GlassCard>

        <Link href="/(auth)/login" style={styles.link}>
          Already have an account?
        </Link>
      </ScrollView>
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  brand: {
    fontSize: typography.size.title1,
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
