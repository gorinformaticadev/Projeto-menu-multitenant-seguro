"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { resolveAuthenticatedShellTheme } from "@/lib/app-theme";

function AuthPublicClassManager() {
  React.useEffect(() => {
    document.documentElement.classList.add("auth-public");
    return () => {
      document.documentElement.classList.remove("auth-public");
    };
  }, []);
  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps & { children: React.ReactNode }) {
    const { user } = useAuth();
    const hasAuthenticatedUser = Boolean(user);

    if (hasAuthenticatedUser) {
      const authenticatedShellTheme = resolveAuthenticatedShellTheme(user?.preferences?.theme);
      const {
        forcedTheme,
        storageKey,
        ...sharedProviderProps
      } = props;
      void forcedTheme;
      void storageKey;

      return (
        <NextThemesProvider
          {...sharedProviderProps}
          forcedTheme={authenticatedShellTheme}
        >
          {children}
        </NextThemesProvider>
      );
    }

    // Páginas públicas (login, esqueci-senha, redefinir-senha) não obedecem
    // ao tema do sistema — o auth-theme é fixo e autossuficiente.
    // A classe auth-public no <html> garante que o portal Radix (toast)
    // herde os tokens corretos do auth-theme.
    const { forcedTheme, storageKey, enableSystem, ...publicProviderProps } = props;
    void forcedTheme;
    void storageKey;
    void enableSystem;

    return (
      <NextThemesProvider
        {...publicProviderProps}
        forcedTheme="light"
      >
        <AuthPublicClassManager />
        {children}
      </NextThemesProvider>
    );
}
