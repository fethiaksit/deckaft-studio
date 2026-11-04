import { useColorScheme, useWindowDimensions } from "react-native";
import { usePreferences } from "../store/preferences";
import { isTabletLayout } from "./layout";
export const dark = {
  background: "#101317",
  surface: "#1C2128",
  raised: "#252C35",
  accent: "#E8B547",
  text: "#FFFFFF",
  muted: "#9CA3AF",
  border: "#303842",
  danger: "#FF8C8C",
  canvas: "#13191F",
  grid: "#2A333E",
  accentText: "#19150C",
};
export const light: typeof dark = {
  background: "#F5F5F2",
  surface: "#FFFFFF",
  raised: "#EDEEEB",
  accent: "#E8B547",
  text: "#192127",
  muted: "#58636D",
  border: "#D7DCD9",
  danger: "#B42332",
  canvas: "#FAFBF9",
  grid: "#DDE2DF",
  accentText: "#19150C",
};
export type Palette = typeof dark;
export function useTheme() {
  const preference = usePreferences((s) => s.theme);
  const system = useColorScheme();
  const isDark =
    preference === "system" ? system !== "light" : preference === "dark";
  return { colors: isDark ? dark : light, isDark };
}
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    tablet: isTabletLayout(width, height),
    landscape: width > height,
  };
}
