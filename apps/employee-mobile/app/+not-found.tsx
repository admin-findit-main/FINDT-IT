import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { spacing, theme, typography } from "@findit/theme";
import { GlassBackdrop, GlassCard } from "@findit/theme/native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <GlassBackdrop>
        <View style={styles.container}>
          <GlassCard level="strong" style={styles.card}>
            <Text style={styles.title}>This screen doesn&apos;t exist.</Text>

            <Link href="/" style={styles.link}>
              <Text style={styles.linkText}>Go to home screen!</Text>
            </Link>
          </GlassCard>
        </View>
      </GlassBackdrop>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: { padding: spacing.xl, alignItems: "center" },
  title: {
    color: theme.ink,
    fontSize: typography.size.title3,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.tracking.title,
    textAlign: "center",
  },
  link: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
  },
  linkText: {
    color: theme.accentInk,
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
});
