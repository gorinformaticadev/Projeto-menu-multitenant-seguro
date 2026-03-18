"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";

function normalizeAppTheme(theme?: string | null): "light" | "dark" | "system" {
  if (theme === "dark" || theme === "system") {
    return theme;
  }

  return "light";
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const currentTheme = normalizeAppTheme(theme);

  const updateTheme = async (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);

    if (!user) {
      return;
    }

    try {
      await api.patch("/users/preferences", { theme: newTheme });
    } catch (error: unknown) {
      let errorData = error;
      if (
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        (error as { response: { data: unknown } }).response &&
        typeof (error as { response: { data: unknown } }).response.data === "object"
      ) {
        errorData = (error as { response: { data: unknown } }).response.data;
      }
      console.warn("Nao foi possivel salvar a preferencia de tema:", errorData);
    }
  };

  return (
    <div className="px-2 py-2">
      <div className="mb-2 text-xs font-semibold text-muted-foreground">Modo</div>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 flex-1 px-2 ${currentTheme === "light" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
          onClick={() => updateTheme("light")}
          title="Claro"
        >
          <Sun className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 flex-1 px-2 ${currentTheme === "dark" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
          onClick={() => updateTheme("dark")}
          title="Escuro"
        >
          <Moon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 flex-1 px-2 ${currentTheme === "system" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
          onClick={() => updateTheme("system")}
          title="Sistema"
        >
          <Monitor className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
