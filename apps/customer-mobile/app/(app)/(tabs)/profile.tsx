import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { ScrollView, StyleSheet, Text } from "react-native";
import { displayName } from "@findit/domain";
import { spacing, theme, typography } from "@findit/theme";
import {
  GlassBackdrop,
  GlassButton,
  GlassCard,
  GlassNotice,
  ScreenTitle,
} from "@findit/theme/native";
import { useAuth } from "@/lib/auth";

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <GlassBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + spacing.xxl },
        ]}
      >
        <ScreenTitle title={displayName(profile || {})} />

        <GlassCard style={styles.card}>
          <Text style={styles.meta}>{profile?.email}</Text>
          <Text style={styles.meta}>
            Plan: {profile?.subscription_plan === "plus" ? "FINDIT+" : "FREE"} · Beta
          </Text>
        </GlassCard>

        <GlassNotice tone="muted">
          Owners and employees use the web app or FINDIT Employee for store tools.
        </GlassNotice>

        <GlassButton
          title="Sign out"
          variant="ghost"
          onPress={signOut}
          style={styles.signOut}
        />
      </ScrollView>
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl },
  card: { marginBottom: spacing.md },
  meta: {
    color: theme.inkMuted,
    fontSize: typography.size.body,
    marginTop: spacing.xs,
  },
  signOut: { marginTop: spacing.lg },
});
