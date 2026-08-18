import { Link, Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { spacing, typography } from "@findit/theme";
import { GlassBackdrop, GlassEmptyState, useAppTheme } from "@findit/theme/native";

export default function NotFoundScreen() {
  const theme = useAppTheme();
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <GlassBackdrop style={styles.container}>
        <GlassEmptyState
          title="This screen doesn't exist."
          action={
            <Link
              href="/"
              style={[styles.linkText, { color: theme.accentInk }]}
            >
              Go to home screen!
            </Link>
          }
        />
      </GlassBackdrop>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    padding: spacing.xl,
  },
  linkText: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    paddingVertical: spacing.md,
    textAlign: "center",
  },
});
