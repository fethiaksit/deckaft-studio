import { Tabs } from "expo-router/js-tabs";
import { House, FolderOpen, PenTool, Settings } from "lucide-react-native";
import { useTheme, useResponsive } from "../../src/core/theme/theme";
export default function TabLayout() {
  const { colors } = useTheme();
  const { tablet } = useResponsive();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarItemStyle: { minHeight: 48 },
        tabBarLabelPosition: tablet ? "beside-icon" : "below-icon",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projeler",
          tabBarIcon: ({ color, size }) => (
            <FolderOpen color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="draw"
        options={{
          title: "Çizim",
          tabBarIcon: ({ color, size }) => (
            <PenTool color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ayarlar",
          tabBarIcon: ({ color, size }) => (
            <Settings color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
