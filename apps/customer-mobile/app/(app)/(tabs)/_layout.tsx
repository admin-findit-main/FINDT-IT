import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";
import { theme, typography } from "@findit/theme";
import {
  GlassHeaderBackground,
  GlassTabBarBackground,
  navigationOptions,
} from "@findit/theme/native";

function TabIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: ColorValue;
}) {
  return <FontAwesome size={22} style={{ marginBottom: -2 }} color={props.color as string} name={props.name} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: navigationOptions.tabBarActiveTintColor,
        tabBarInactiveTintColor: navigationOptions.tabBarInactiveTintColor,
        tabBarBackground: () => <GlassTabBarBackground />,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: typography.size.caption,
          fontWeight: typography.weight.semibold,
        },
        headerBackground: () => <GlassHeaderBackground />,
        headerStyle: { backgroundColor: "transparent" },
        headerShadowVisible: false,
        headerTintColor: navigationOptions.headerTintColor,
        headerTitleStyle: {
          fontWeight: typography.weight.bold,
          color: theme.ink,
          letterSpacing: typography.tracking.title,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "FIND IT",
          tabBarIcon: ({ color }) => <TabIcon name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          tabBarIcon: ({ color }) => <TabIcon name="list" color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => <TabIcon name="bell" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
