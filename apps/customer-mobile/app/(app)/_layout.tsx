import { Redirect, Stack } from "expo-router";
import { theme } from "@findit/theme";
import { navigationOptions } from "@findit/theme/native";
import { useAuth } from "@/lib/auth";

export default function AppLayout() {
  const { session, profile, loading } = useAuth();
  if (loading) return null;
  if (!session || profile?.account_type !== "customer") {
    return <Redirect href="/(auth)/login" />;
  }
  return (
    <Stack
      screenOptions={{
        headerTintColor: navigationOptions.headerTintColor,
        headerTitleStyle: navigationOptions.headerTitleStyle,
        headerStyle: { backgroundColor: theme.solidChrome },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.canvas },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="request/[id]"
        options={{ title: "Request", headerBackTitle: "Back" }}
      />
    </Stack>
  );
}
