import { DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import "react-native-reanimated";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { parseEmployeeDeepLink } from "@findit/domain";
import { theme } from "@findit/theme";
import { AppThemeProvider } from "@findit/theme/native";
import { AuthProvider, useAuth } from "@/lib/auth";
import {
  getRequestIdFromNotificationData,
  registerForPushNotificationsAsync,
} from "@/lib/push";

export { ErrorBoundary } from "expo-router";

if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

const navigationTheme = {
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

export default function RootLayout() {
  return (
    <AppThemeProvider scheme="light">
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </AppThemeProvider>
  );
}

function RootNavigator() {
  const { session, stores, loading, activeStore, signOut } = useAuth();
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
    const allowed = Boolean(session && stores.length > 0);
    if (session && stores.length === 0 && !inAuth) {
      // Signed in but not a store member
      signOut();
      router.replace("/(auth)/login");
      return;
    }
    if (!allowed && !inAuth) {
      router.replace("/(auth)/login");
    } else if (allowed && inAuth) {
      router.replace("/(app)/(tabs)");
    }
  }, [loading, session, stores, segments, router, signOut]);

  useEffect(() => {
    if (!session || !activeStore) return;
    registerForPushNotificationsAsync(activeStore.id);
  }, [session, activeStore?.id]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = parseEmployeeDeepLink(url);
      if (parsed?.type === "request") {
        router.push(`/(app)/request/${parsed.id}`);
      }
    };
    Linking.getInitialURL().then((url) => url && handleUrl(url));
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
    <ThemeProvider value={navigationTheme}>
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
