import { Redirect, Stack } from "expo-router";
import { theme } from "@findit/theme";
import { GlassHeaderBackground, navigationOptions } from "@findit/theme/native";
import { useAuth } from "@/lib/auth";

export default function AppLayout() {
  const { session, stores, loading } = useAuth();
  if (loading) return null;
  if (!session || stores.length === 0) {
    return <Redirect href="/(auth)/login" />;
  }
  return (
    <Stack
      screenOptions={{
        headerTintColor: navigationOptions.headerTintColor,
        headerTitleStyle: navigationOptions.headerTitleStyle,
        headerStyle: { backgroundColor: "transparent" },
        headerShadowVisible: false,
        headerBackground: () => <GlassHeaderBackground />,
        contentStyle: { backgroundColor: theme.canvas },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="request/[id]"
        options={{ title: "Respond", headerBackTitle: "Queue" }}
      />
    </Stack>
  );
}
