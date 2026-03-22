export const APP_THEME_VALUES = ["light", "dark", "system"] as const;

export type AppThemePreference = (typeof APP_THEME_VALUES)[number];
export const PUBLIC_THEME_STORAGE_KEY = "public-shell-theme";
export const AUTHENTICATED_SHELL_DEFAULT_THEME: AppThemePreference = "light";

/**
 * Contrato final do shell autenticado:
 * - AuthContext: fonte canonica, persistencia no backend e rollback
 * - ThemeProvider: aplica no DOM somente o tema canonico do shell autenticado
 * - ThemeToggle: apenas solicita a troca da preferencia do usuario
 * - AppLayout e demais componentes do shell nao sincronizam tema diretamente
 * - Ausencia de preferencia persistida no shell autenticado = tema claro
 */
export function normalizeAppThemePreference(theme?: string | null): AppThemePreference {
  if (theme === "dark" || theme === "system") {
    return theme;
  }

  return AUTHENTICATED_SHELL_DEFAULT_THEME;
}

export function resolveAuthenticatedShellTheme(theme?: string | null): AppThemePreference {
  return normalizeAppThemePreference(theme);
}
