import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registerPushToken } from "@findit/supabase-client";
import { supabase } from "./supabase";
import { captureException, captureMessage } from "./monitoring";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(storeId?: string | null) {
  if (!Device.isDevice) {
    captureMessage("Push skipped: simulator");
    return null;
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  try {
    const token = (
      await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    ).data;
    const platform = Platform.OS === "ios" ? "ios" : "android";
    const result = await registerPushToken(supabase, {
      token,
      platform,
      appSurface: "employee",
      storeId: storeId ?? null,
    });
    if ("error" in result) captureException(result.error);
    return token;
  } catch (e) {
    captureException(e);
    return null;
  }
}

export function getRequestIdFromNotificationData(
  data: Record<string, unknown> | undefined
): string | null {
  if (!data) return null;
  const id = data.requestId ?? data.request_id;
  return typeof id === "string" ? id : null;
}
