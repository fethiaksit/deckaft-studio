import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DatabaseProvider } from "../src/core/db/provider";
import { useTheme } from "../src/core/theme/theme";
export { ErrorBoundary } from "expo-router";
function Navigation() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="project/[id]" />
        <Stack.Screen name="drawing/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="module/[id]" />
        <Stack.Screen name="framing/[id]" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DatabaseProvider>
          <Navigation />
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
