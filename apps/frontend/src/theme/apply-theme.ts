import { ThemeTokens } from "./theme-types";
import { themeTokenVars } from "./tokens";

export function applyTheme(theme: ThemeTokens, element: HTMLElement = document.documentElement) {
  Object.entries(theme).forEach(([key, value]) => {
    const varName = themeTokenVars[key as keyof ThemeTokens];
    if (varName) {
      // Valor esperado é em formato "r g b", por exemplo: "255 255 255"
      element.style.setProperty(varName, value);
    }
  });
}

export function removeTheme(element: HTMLElement = document.documentElement) {
  Object.values(themeTokenVars).forEach((varName) => {
    element.style.removeProperty(varName);
  });
}
