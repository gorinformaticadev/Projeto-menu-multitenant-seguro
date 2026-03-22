"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeAppThemePreference } from "@/lib/app-theme";

export function ThemeProvider({ children, ...props }: ThemeProviderProps & { children: React.ReactNode }) {
    const { user } = useAuth();
    const authenticatedShellTheme = user
      ? normalizeAppThemePreference(user.preferences?.theme)
      : undefined;

    return (
      <NextThemesProvider
        {...props}
        forcedTheme={authenticatedShellTheme ?? props.forcedTheme}
      >
        {children}
      </NextThemesProvider>
    );
}
