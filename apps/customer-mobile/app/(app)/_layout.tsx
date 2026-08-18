import { Platform } from "react-native";
import { Stack } from "expo-router";
import { GlassHeaderBackground, useAppTheme, useNavigationOptions } from "@findit/theme/native";
import { useAuth } from "@/lib/auth";
import { customerNeedsFirstName } from "@findit/domain";
import { CustomerMenuProvider } from "@/components/app-menu";

export default function AppLayout() {
  const theme = useAppTheme();
  const navigationOptions = useNavigationOptions();
  const { session, profile, loading } = useAuth();
  if (loading) return null;
  if (!session || profile?.account_type !== "customer") return null;
  if (customerNeedsFirstName(profile)) return null;
  return (
    <CustomerMenuProvider>
      <Stack
        screenOptions={{
          headerTintColor: navigationOptions.headerTintColor,
          headerTitleStyle: navigationOptions.headerTitleStyle,
          headerBackground: () => <GlassHeaderBackground />,
          headerStyle: { backgroundColor: "transparent" },
          headerShadowVisible: false,
          headerBackTitle: "Back",
          contentStyle: { backgroundColor: theme.canvas },
          animation: Platform.OS === "ios" ? "default" : "slide_from_right",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "none" }} />
        <Stack.Screen
          name="request/[id]"
          options={{ title: "Request" }}
        />
      </Stack>
    </CustomerMenuProvider>
  );
}
