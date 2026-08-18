import { Tabs } from "expo-router/js-tabs";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={() => null}
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        animation: "none",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Find" }} />
      <Tabs.Screen name="requests" options={{ title: "Requests" }} />
      <Tabs.Screen name="notifications" options={{ title: "Alerts" }} />
      <Tabs.Screen name="plan" options={{ title: "Plan" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
