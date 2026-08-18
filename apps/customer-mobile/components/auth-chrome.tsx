import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, typography } from "@findit/theme";
import { useAppTheme } from "@findit/theme/native";
import { BrandMark } from "@/components/brand";

export function AuthHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.header}>
      <BrandMark tone={theme.scheme === "dark" ? "dark" : "light"} style={styles.markImg} />
      <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
      <Text style={[styles.sub, { color: theme.inkMuted }]}>{subtitle}</Text>
    </View>
  );
}

export function AuthFooter({
  secondaryLabel,
  onSecondary,
  linkHref,
  linkLabel,
}: {
  secondaryLabel: string;
  onSecondary: () => void;
  linkHref: Href;
  linkLabel: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.footer}>
      <Pressable onPress={onSecondary} hitSlop={8} style={styles.footerPress}>
        <Text style={[styles.footerText, { color: theme.inkMuted }]}>{secondaryLabel}</Text>
      </Pressable>
      <Text style={[styles.dot, { color: theme.inkSubtle }]}>·</Text>
      <Link href={linkHref} style={styles.footerPress}>
        <Text style={[styles.footerText, { color: theme.inkMuted }]}>{linkLabel}</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.xl },
  markImg: { height: 36, width: 39, marginBottom: spacing.lg },
  title: {
    fontSize: typography.size.title2,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.tracking.title,
  },
  sub: {
    fontSize: typography.size.footnote,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    minHeight: 44,
  },
  footerPress: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  footerText: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.medium,
  },
  dot: { fontSize: typography.size.footnote },
});
