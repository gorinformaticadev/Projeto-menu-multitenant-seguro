import { ThemeTokens } from "./theme-types";

export const lightTheme: ThemeTokens = {
  background: "241 245 249",
  backgroundElevated: "248 250 252",
  surface: "255 255 255",
  surfaceHover: "241 245 249",
  border: "226 232 240",
  borderStrong: "148 163 184",
  text: "15 23 42",
  textMuted: "100 116 139",
  textInverse: "255 255 255",
  primary: "37 99 235",
  primaryHover: "29 78 216",
  secondary: "241 245 249",
  success: "34 197 94",
  warning: "245 158 11",
  danger: "239 68 68",
  info: "14 165 233",
  inputBackground: "255 255 255",
  inputBorder: "226 232 240",
  focusRing: "59 130 246", // blue-500
  sidebarBackground: "255 255 255",
  sidebarText: "71 85 105",
  sidebarActive: "37 99 235",
  menuHover: "241 245 249",
};

export const darkTheme: ThemeTokens = {
  background: "10 10 10",
  backgroundElevated: "15 15 15",
  surface: "10 10 10",
  surfaceHover: "38 38 38",
  border: "38 38 38",
  borderStrong: "70 70 70",
  text: "250 250 250",
  textMuted: "163 163 163",
  textInverse: "10 10 10",
  primary: "250 250 250",
  primaryHover: "226 228 234",
  secondary: "24 24 27",
  success: "34 197 94",
  warning: "245 158 11",
  danger: "127 29 29",
  info: "14 165 233",
  inputBackground: "10 10 10",
  inputBorder: "38 38 38",
  focusRing: "60 130 246",
  sidebarBackground: "10 10 10",
  sidebarText: "226 232 240",
  sidebarActive: "250 250 250",
  menuHover: "38 38 38",
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};
