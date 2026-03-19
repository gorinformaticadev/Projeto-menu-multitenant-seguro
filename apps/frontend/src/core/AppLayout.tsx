"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useModuleRegistry } from "@/hooks/useModuleRegistry";
import { ModuleLoader } from "@/core/ModuleLoader";
import { Button } from "./ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { isInitialized, error } = useModuleRegistry();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  // Páginas onde o sidebar e topbar NÃO devem aparecer
  const publicPages = ["/", "/login", "/esqueci-senha", "/redefinir-senha"];
  const isPublicPage = publicPages.includes(pathname);

  // Se está carregando ou é página pública, não mostra sidebar nem topbar
  if (loading || isPublicPage || !user) {
    return <>{children}</>;
  }

  // Se o registry não foi inicializado, mostra loading
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-skin-primary"></div>
          <p className="text-skin-text-muted">Inicializando sistema...</p>
          {error && (
            <p className="mt-2 text-sm text-skin-danger">Erro: {error}</p>
          )}
        </div>
      </div>
    );
  }

  // Mostra topbar e sidebar fixos em todas as outras páginas
  return (
    <div className="flex h-screen overflow-hidden">
      <ModuleLoader />
      {/* TopBar Fixa */}
      <TopBar />

      {/* Layout com Sidebar e Conteúdo */}
      <div className="flex w-full pt-16">
        <aside className="h-[calc(100vh-4rem)] flex-shrink-0">
          <Sidebar isExpanded={isSidebarExpanded} />
        </aside>
        <div className="pt-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarExpanded((current) => !current)}
            className="ml-2 h-8 w-8 rounded-full border border-skin-border bg-skin-surface text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text"
            aria-label={isSidebarExpanded ? "Recolher barra lateral" : "Expandir barra lateral"}
          >
            {isSidebarExpanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        </div>
        <main className="flex-1 overflow-y-auto bg-skin-background">
          {children}
        </main>
      </div>
    </div>
  );
}
