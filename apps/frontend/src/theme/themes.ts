import { ThemeTokens } from "./theme-types";

export const lightTheme: ThemeTokens = {
  background: "241 245 249", // #f1f5f9
  backgroundElevated: "248 250 252", // slate-50
  surface: "255 255 255",
  surfaceHover: "241 245 249",
  border: "226 232 240", // slate-200
  borderStrong: "148 163 184", // slate-400
  text: "15 23 42", // slate-900
  textMuted: "100 116 139", // slate-500
  textInverse: "255 255 255",
  primary: "37 99 235", // blue-600
  primaryHover: "29 78 216", // blue-700
  secondary: "241 245 249",
  success: "34 197 94", // green-500
  warning: "245 158 11", // amber-500
  danger: "239 68 68", // red-500
  info: "14 165 233", // sky-500
  inputBackground: "255 255 255",
  inputBorder: "226 232 240",
  focusRing: "59 130 246", // blue-500
  sidebarBackground: "255 255 255",
  sidebarText: "71 85 105", // slate-600
  sidebarActive: "37 99 235",
  menuHover: "241 245 249",
};

export const darkTheme: ThemeTokens = {
  background: "10 10 10", // Da variável --background: 0 0% 3.9%
  backgroundElevated: "15 15 15",
  surface: "10 10 10",
  surfaceHover: "38 38 38", // Da variável --accent: 0 0% 14.9%
  border: "38 38 38", // Da variável --border: 0 0% 14.9%
  borderStrong: "70 70 70",
  text: "250 250 250", // Da variável --foreground: 0 0% 98%
  textMuted: "163 163 163", // Da variável --muted-foreground: 0 0% 63.9%
  textInverse: "10 10 10",
  primary: "250 250 250", // Da variável --primary: 0 0% 98%
  primaryHover: "226 228 234",
  secondary: "24 24 27", // Neutral
  success: "34 197 94",
  warning: "245 158 11",
  danger: "127 29 29", // Da variável --destructive: 0 62.8% 30.6%
  info: "14 165 233",
  inputBackground: "10 10 10",
  inputBorder: "38 38 38",
  focusRing: "60 130 246", // ring
  sidebarBackground: "10 10 10",
  sidebarText: "226 232 240",
  sidebarActive: "250 250 250",
  menuHover: "38 38 38",
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};
