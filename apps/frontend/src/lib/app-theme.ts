export const APP_THEME_STORAGE_KEY = "theme";
export const APP_THEME_VALUES = ["light", "dark", "system"] as const;

export type AppThemePreference = (typeof APP_THEME_VALUES)[number];

/**
 * Contrato do shell autenticado:
 * - AuthContext: fonte canonica, persistencia e rollback
 * - ThemeProvider: aplica a preferencia canonica no DOM
 * - ThemeToggle: apenas dispara a troca de preferencia do usuario
 */
export function normalizeAppThemePreference(theme?: string | null): AppThemePreference {
  if (theme === "dark" || theme === "system") {
    return theme;
  }

  return "light";
}
