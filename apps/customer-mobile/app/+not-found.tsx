import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { spacing, theme, typography } from '@findit/theme';
import { GlassBackdrop, GlassEmptyState } from '@findit/theme/native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <GlassBackdrop style={styles.container}>
        <GlassEmptyState
          title="This screen doesn't exist."
          action={
            <Link href="/" style={styles.linkText}>
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
    justifyContent: 'center',
    padding: spacing.xl,
  },
  linkText: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    color: theme.accentInk,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
});
