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
  backgroundElevated: "20 20 24",
  surface: "24 24 27",
  surfaceHover: "38 38 42",
  border: "50 50 56",
  borderStrong: "82 82 91",
  text: "250 250 250",
  textMuted: "163 163 163",
  textInverse: "10 10 10",
  primary: "250 250 250",
  primaryHover: "226 228 234",
  secondary: "24 24 27",
  success: "34 197 94",
  warning: "245 158 11",
  danger: "248 113 113",
  info: "14 165 233",
  inputBackground: "20 20 24",
  inputBorder: "50 50 56",
  focusRing: "60 130 246",
  sidebarBackground: "18 18 20",
  sidebarText: "226 232 240",
  sidebarActive: "250 250 250",
  menuHover: "44 44 48",
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};
