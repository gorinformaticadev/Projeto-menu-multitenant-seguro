"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { useModuleRegistry } from "@/hooks/useModuleRegistry";
import { ModuleRegistryTaskbar } from "./ModuleRegistryTaskbar";
import { ModuleLoader } from "@/core/ModuleLoader";
import { RouteGuard } from "./RouteGuard";
import { useTheme } from "next-themes";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "./ui/button";

function normalizeAppThemePreference(theme?: string | null): "light" | "dark" | "system" {
  if (theme === "dark" || theme === "system") {
    return theme;
  }

  return "light";
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { isInitialized, error } = useModuleRegistry();
  const { setTheme, theme } = useTheme();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const lastAppliedThemeRef = useRef<"light" | "dark" | "system" | null>(null);

  // Sincroniza o tema do usuario antes da pintura para evitar flicker apos o login.
  useLayoutEffect(() => {
    if (!user) {
      lastAppliedThemeRef.current = null;
      return;
    }

    const preferredTheme = normalizeAppThemePreference(user.preferences?.theme);

    if (theme === preferredTheme) {
      lastAppliedThemeRef.current = preferredTheme;
      return;
    }

    if (lastAppliedThemeRef.current === preferredTheme) {
      return;
    }

    lastAppliedThemeRef.current = preferredTheme;
    setTheme(preferredTheme);
  }, [user, theme, setTheme]);

  // Páginas onde o sidebar e topbar NÃO devem aparecer
  const publicPages = ["/", "/login", "/esqueci-senha", "/redefinir-senha"];
  const isPublicPage = publicPages.includes(pathname);

  useEffect(() => {
    const shouldLockDocumentScroll = !loading && !isPublicPage && Boolean(user);
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    html.style.overflow = shouldLockDocumentScroll ? "hidden" : previousHtmlOverflow;
    body.style.overflow = shouldLockDocumentScroll ? "hidden" : previousBodyOverflow;

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [isPublicPage, loading, user]);

  // Se está carregando ou é página pública, não mostra sidebar nem topbar
  if (loading || isPublicPage || !user) {
    return (
      <RouteGuard>
        {children}
      </RouteGuard>
    );
  }

  // Se o registry não foi inicializado, mostra loading
  if (!isInitialized) {
    return (
      <RouteGuard>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-skin-primary"></div>
            <p className="text-skin-text-muted">Inicializando sistema modular...</p>
            {error && (
              <p className="mt-2 text-sm text-skin-danger">Erro: {error}</p>
            )}
          </div>
        </div>
      </RouteGuard>
    );
  }

  // Mostra topbar e sidebar fixos em todas as outras páginas
  return (
    <RouteGuard>
      <div className="flex h-screen overflow-hidden">
        {/* Carregador de Módulos Dinâmicos */}
        <ModuleLoader />

        {/* TopBar Fixa */}
        <TopBar />

        {/* Layout com Sidebar e Conteúdo */}
        <div className="flex h-full min-h-0 w-full overflow-hidden pt-16 pb-16 md:pb-0">
          <aside className="hidden h-full min-h-0 flex-shrink-0 md:flex">
            <Sidebar isExpanded={isSidebarExpanded} />
          </aside>
          <div className="hidden md:flex md:items-start md:pt-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarExpanded((current) => !current)}
              className="ml-2 h-8 w-8 rounded-full border border-skin-border bg-skin-surface text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text"
              aria-label={isSidebarExpanded ? "Recolher barra lateral" : "Expandir barra lateral"}
              title={isSidebarExpanded ? "Recolher barra lateral" : "Expandir barra lateral"}
            >
              {isSidebarExpanded ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
          </div>
          <main className="min-h-0 flex-1 overflow-y-auto bg-skin-background p-0 text-skin-text">
            {children}
          </main>
        </div>

        {/* Navegação Mobile (Apenas Mobile) */}
        <BottomNav />

        {/* Taskbar dos Módulos */}
        <ModuleRegistryTaskbar />
      </div>
    </RouteGuard>
  );
}
