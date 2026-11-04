import { create } from "zustand";
export type ThemePreference = "dark" | "light" | "system";
export const usePreferences = create<{
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}>((set) => ({ theme: "dark", setTheme: (theme) => set({ theme }) }));
