"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { resolveAuthenticatedShellTheme } from "@/lib/app-theme";

export function ThemeProvider({ children, ...props }: ThemeProviderProps & { children: React.ReactNode }) {
    const { user } = useAuth();
    const hasAuthenticatedUser = Boolean(user);

    if (hasAuthenticatedUser) {
      const authenticatedShellTheme = resolveAuthenticatedShellTheme(user?.preferences?.theme);
      const {
        forcedTheme: _ignoredForcedTheme,
        storageKey: _ignoredStorageKey,
        ...sharedProviderProps
      } = props;

      return (
        <NextThemesProvider
          {...sharedProviderProps}
          forcedTheme={authenticatedShellTheme}
        >
          {children}
        </NextThemesProvider>
      );
    }

    return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
