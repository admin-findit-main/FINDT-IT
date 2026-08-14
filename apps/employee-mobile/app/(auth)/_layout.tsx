import { Stack } from "expo-router";
import { theme } from "@findit/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.canvas },
      }}
    >
      <Stack.Screen name="login" />
    </Stack>
  );
}
