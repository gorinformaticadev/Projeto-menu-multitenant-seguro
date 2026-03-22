"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { type AppThemePreference, resolveAuthenticatedShellTheme } from "@/lib/app-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const { user, saveThemePreference } = useAuth();
  const { toast } = useToast();
  const currentTheme = resolveAuthenticatedShellTheme(user?.preferences?.theme);

  // Este componente apenas solicita a troca da preferencia canonica.
  // Aplicacao no DOM, persistencia e rollback pertencem ao AuthContext + ThemeProvider.
  const updateTheme = async (newTheme: AppThemePreference) => {
    if (newTheme === currentTheme) {
      return;
    }

    try {
      await saveThemePreference(newTheme);
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
      toast({
        title: "Nao foi possivel salvar o tema",
        description: "A preferencia visual foi revertida para manter o shell consistente.",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className={cn("px-2 py-2", className)}>
      <div className="mb-2 text-xs font-semibold text-skin-text-muted">Modo</div>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-skin-background-elevated/60 p-1">
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 flex-1 px-2 ${currentTheme === "light" ? "bg-skin-surface text-skin-primary shadow-sm" : "text-skin-text-muted"}`}
          onClick={() => updateTheme("light")}
          title="Claro"
          aria-label="Ativar tema claro"
          aria-pressed={currentTheme === "light"}
        >
          <Sun className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 flex-1 px-2 ${currentTheme === "dark" ? "bg-skin-surface text-skin-primary shadow-sm" : "text-skin-text-muted"}`}
          onClick={() => updateTheme("dark")}
          title="Escuro"
          aria-label="Ativar tema escuro"
          aria-pressed={currentTheme === "dark"}
        >
          <Moon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 flex-1 px-2 ${currentTheme === "system" ? "bg-skin-surface text-skin-primary shadow-sm" : "text-skin-text-muted"}`}
          onClick={() => updateTheme("system")}
          title="Sistema"
          aria-label="Usar tema do sistema"
          aria-pressed={currentTheme === "system"}
        >
          <Monitor className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
