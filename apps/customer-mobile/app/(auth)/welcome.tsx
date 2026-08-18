import { useState } from "react";
import { StyleSheet } from "react-native";
import { spacing } from "@findit/theme";
import {
  GlassButton,
  GlassCard,
  GlassInput,
  GlassNotice,
} from "@findit/theme/native";
import { AuthHeader } from "@/components/auth-chrome";
import { Screen } from "@/components/screen";
import { useAuth } from "@/lib/auth";

export default function WelcomeScreen() {
  const { completeFirstName } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const res = await completeFirstName(firstName);
    if (res.error) setError(res.error);
    setBusy(false);
  };

  return (
    <Screen variant="auth">
      <AuthHeader
        title="What’s your first name?"
        subtitle="That’s all we need to get started."
      />
      <GlassCard>
        <GlassInput
          inset
          last
          placeholder="First name"
          autoComplete="given-name"
          value={firstName}
          onChangeText={setFirstName}
        />
        {error ? <GlassNotice>{error}</GlassNotice> : null}
        <GlassButton
          title="Continue"
          size="lg"
          loading={busy}
          disabled={busy}
          onPress={onSubmit}
          style={styles.cta}
        />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cta: { marginTop: spacing.lg },
});
