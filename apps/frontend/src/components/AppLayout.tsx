"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { useModuleRegistry } from "@/hooks/useModuleRegistry";
import { ModuleRegistryTaskbar } from "./ModuleRegistryTaskbar";
import { ModuleLoader } from "@/core/ModuleLoader";
import { RouteGuard } from "./RouteGuard";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "./ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { isInitialized, error } = useModuleRegistry();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

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

  // O tema do shell autenticado e aplicado exclusivamente pelo ThemeProvider.
  // Este layout nao deve sincronizar classes de tema nem disputar essa responsabilidade.

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
          <div className="relative hidden h-full min-h-0 flex-shrink-0 md:flex">
            <aside className="h-full min-h-0">
              <Sidebar isExpanded={isSidebarExpanded} />
            </aside>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarExpanded((current) => !current)}
              className="absolute -right-3 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full border border-skin-border/90 bg-skin-surface text-skin-text-muted shadow-sm transition-all duration-200 hover:bg-skin-surface-hover hover:text-skin-text"
              aria-label={isSidebarExpanded ? "Recolher barra lateral" : "Expandir barra lateral"}
              title={isSidebarExpanded ? "Recolher barra lateral" : "Expandir barra lateral"}
            >
              {isSidebarExpanded ? (
                <ChevronsLeft className="h-3.5 w-3.5" />
              ) : (
                <ChevronsRight className="h-3.5 w-3.5" />
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
