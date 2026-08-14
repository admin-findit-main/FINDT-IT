import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import { useWindowDimensions, type ColorValue } from "react-native";
import { theme, typography } from "@findit/theme";
import {
  GlassHeaderBackground,
  GlassTabBarBackground,
  navigationOptions,
} from "@findit/theme/native";
import { TABLET_WIDTH } from "@/components/useTabContentInset";

function TabIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: ColorValue;
}) {
  return <FontAwesome size={22} style={{ marginBottom: -2 }} color={props.color as string} name={props.name} />;
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const tablet = width >= TABLET_WIDTH;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: navigationOptions.tabBarActiveTintColor,
        tabBarInactiveTintColor: navigationOptions.tabBarInactiveTintColor,
        headerTintColor: navigationOptions.headerTintColor,
        headerTitleStyle: navigationOptions.headerTitleStyle,
        headerStyle: { backgroundColor: "transparent" },
        headerShadowVisible: false,
        headerBackground: () => <GlassHeaderBackground />,
        sceneStyle: { backgroundColor: theme.canvas },
        // Floating glass bar: the screens reserve its height via `useTabContentInset`.
        tabBarBackground: () => <GlassTabBarBackground />,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
          height: tablet ? 64 : undefined,
        },
        tabBarLabelStyle: {
          fontSize: tablet ? 14 : typography.size.caption,
          fontWeight: typography.weight.semibold,
          letterSpacing: typography.tracking.caption,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Requests",
          tabBarIcon: ({ color }) => <TabIcon name="inbox" color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarIcon: ({ color }) => <TabIcon name="history" color={color} />,
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
