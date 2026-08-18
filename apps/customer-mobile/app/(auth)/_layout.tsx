import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useAppTheme } from "@findit/theme/native";

export default function AuthLayout() {
  const theme = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.canvas },
        animation: Platform.OS === "ios" ? "default" : "slide_from_right",
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="welcome" options={{ animation: "fade", gestureEnabled: false }} />
    </Stack>
  );
}
