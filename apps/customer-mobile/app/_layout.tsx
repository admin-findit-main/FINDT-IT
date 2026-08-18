import "react-native-gesture-handler";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { customerNeedsFirstName, parseCustomerDeepLink } from "@findit/domain";
import { useAppTheme } from "@findit/theme/native";
import { AppearanceProvider, useAppearance } from "@/lib/appearance";
import { AuthProvider, useAuth } from "@/lib/auth";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  getRequestIdFromNotificationData,
  registerForPushNotificationsAsync,
} from "@/lib/push";

export { ErrorBoundary } from "expo-router";

if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppearanceProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </AppearanceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { session, profile, loading, signOut } = useAuth();
  const theme = useAppTheme();
  const { scheme } = useAppearance();
  const router = useRouter();
  const segments = useSegments();
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);
  const lastTarget = useRef<string | null>(null);
  const navTheme = useMemo(
    () => ({
      ...(scheme === "light" ? DefaultTheme : DarkTheme),
      colors: {
        ...(scheme === "light" ? DefaultTheme.colors : DarkTheme.colors),
        primary: theme.accent,
        background: theme.canvas,
        card: theme.solidChrome,
        text: theme.ink,
        border: theme.hairlineStrong,
        notification: theme.accent,
      },
    }),
    [scheme, theme]
  );

  useEffect(() => {
    hasSeenOnboarding().then(setSeenOnboarding);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (loading || seenOnboarding === null) return;
    const group = String(segments[0] || "");
    const screen = String(segments[1] || "");
    const inAuth = group === "(auth)";
    const inApp = group === "(app)";
    const isCustomer = Boolean(session && profile?.account_type === "customer");
    const needsName = customerNeedsFirstName(profile || {});
    const onLoginOrSignup = inAuth && (screen === "login" || screen === "signup");

    if (session && profile && profile.account_type !== "customer") {
      if (!onLoginOrSignup) {
        lastTarget.current = "/(auth)/login";
        router.replace("/(auth)/login?reason=customer-only" as Href);
      }
      signOut();
      return;
    }
    if (session && !profile) return;

    let target: Href | null = null;
    if (!isCustomer) {
      if (!seenOnboarding && !onLoginOrSignup) {
        if (!(inAuth && screen === "onboarding")) target = "/(auth)/onboarding";
      } else if (seenOnboarding && (!inAuth || screen === "onboarding" || screen === "welcome")) {
        target = "/(auth)/login";
      }
    } else if (needsName) {
      if (!(inAuth && screen === "welcome")) target = "/(auth)/welcome";
    } else if (!inApp) {
      target = "/(app)/(tabs)";
    }

    if (!target) return;
    const next = String(target);
    if (lastTarget.current === next) return;
    lastTarget.current = next;
    router.replace(target);
  }, [loading, seenOnboarding, session, profile, segments, router, signOut]);

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
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.canvas },
          animation: "fade",
          animationDuration: 280,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
