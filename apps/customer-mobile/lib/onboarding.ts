import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "findit.onboarding.v1";

export async function hasSeenOnboarding(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === "1";
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}
