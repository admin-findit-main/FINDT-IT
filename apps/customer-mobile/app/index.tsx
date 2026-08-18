import { ActivityIndicator, StyleSheet } from "react-native";
import { GlassBackdrop, useAppTheme } from "@findit/theme/native";

export default function Index() {
  const theme = useAppTheme();
  return (
    <GlassBackdrop style={styles.center}>
      <ActivityIndicator color={theme.accent} />
    </GlassBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
