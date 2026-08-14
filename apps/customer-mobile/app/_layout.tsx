import { DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import "react-native-reanimated";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { parseCustomerDeepLink } from "@findit/domain";
import { theme } from "@findit/theme";
import { AuthProvider, useAuth } from "@/lib/auth";
import {
  getRequestIdFromNotificationData,
  registerForPushNotificationsAsync,
} from "@/lib/push";

export { ErrorBoundary } from "expo-router";

/** The app is light-only, so the navigation chrome is pinned to the glass palette. */
const glassNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.accent,
    background: theme.canvas,
    card: theme.solidChrome,
    text: theme.ink,
    border: theme.hairlineStrong,
    notification: theme.accent,
  },
};

if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { session, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!loading && Platform.OS !== "web") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    const isCustomer = Boolean(session && profile?.account_type === "customer");
    if (session && profile && profile.account_type !== "customer") {
      signOut();
      return;
    }
    if (!isCustomer && !inAuth) {
      router.replace("/(auth)/login");
    } else if (isCustomer && inAuth) {
      router.replace("/(app)/(tabs)");
    }
  }, [loading, session, profile, segments, router, signOut]);

  useEffect(() => {
    if (!session || profile?.account_type !== "customer") return;
    registerForPushNotificationsAsync();
  }, [session, profile?.account_type]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = parseCustomerDeepLink(url);
      if (parsed?.type === "request") {
        router.push(`/(app)/request/${parsed.id}`);
      }
    };
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const linkSub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = getRequestIdFromNotificationData(
        response.notification.request.content.data as Record<string, unknown>
      );
      if (id) router.push(`/(app)/request/${id}`);
    });
    return () => {
      linkSub.remove();
      notifSub.remove();
    };
  }, [router]);

  return (
    <ThemeProvider value={glassNavigationTheme}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.canvas },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </ThemeProvider>
  );
}
