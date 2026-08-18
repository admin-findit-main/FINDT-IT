import { Pressable, StyleSheet, Text, View } from "react-native";
import { spacing, typography } from "@findit/theme";
import { IosSwitch, useAppTheme } from "@findit/theme/native";

export function SettingsSection({ title }: { title: string }) {
  const theme = useAppTheme();
  return (
    <Text
      style={{
        color: theme.inkMuted,
        fontSize: typography.size.caption,
        fontWeight: typography.weight.semibold,
        letterSpacing: 0.4,
        marginBottom: spacing.sm,
        marginTop: spacing.lg,
        paddingHorizontal: spacing.xs,
      }}
    >
      {title}
    </Text>
  );
}

export function SettingsRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: theme.hairlineStrong, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
      ]}
    >
      <Text style={[styles.label, { color: theme.inkMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.value, { color: theme.ink }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function SettingsChoice({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.choice, { backgroundColor: theme.solid3 }]}>
      {options.map((option) => {
        const on = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.id)}
            style={({ pressed }) => [
              styles.choiceItem,
              on && { backgroundColor: theme.solid1 },
              pressed && { opacity: 0.72 },
            ]}
          >
            <Text
              numberOfLines={1}
              style={{
                color: on ? theme.ink : theme.inkMuted,
                fontSize: typography.size.footnote,
                fontWeight: on ? typography.weight.semibold : typography.weight.medium,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingsToggle({
  label,
  value,
  onChange,
  last = false,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  last?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.hairlineStrong,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          backgroundColor: pressed ? theme.solid3 : "transparent",
        },
      ]}
    >
      <Text style={[styles.toggleLabel, { color: theme.ink }]}>{label}</Text>
      <IosSwitch value={value} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: typography.size.footnote,
    flexShrink: 0,
    maxWidth: "42%",
  },
  value: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.medium,
    textAlign: "right",
  },
  toggleLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.medium,
  },
  choice: {
    flexDirection: "row",
    margin: spacing.sm,
    padding: 3,
    borderRadius: 10,
    gap: 3,
  },
  choiceItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
});
