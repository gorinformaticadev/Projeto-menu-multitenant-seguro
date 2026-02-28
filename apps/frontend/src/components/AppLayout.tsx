"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { useModuleRegistry } from "@/hooks/useModuleRegistry";
import { ModuleRegistryTaskbar } from "./ModuleRegistryTaskbar";
import { ModuleLoader } from "@/core/ModuleLoader";
import { RouteGuard } from "./RouteGuard";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { isInitialized, error } = useModuleRegistry();

  // Páginas onde o sidebar e topbar NÃO devem aparecer
  const publicPages = ["/", "/login", "/esqueci-senha", "/redefinir-senha"];
  const isPublicPage = publicPages.includes(pathname);

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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Inicializando sistema modular...</p>
            {error && (
              <p className="text-red-500 text-sm mt-2">Erro: {error}</p>
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
        <div className="flex w-full pt-16 pb-16 md:pb-0">
          <aside className="hidden md:flex flex-shrink-0 h-[calc(100vh-4rem)]">
            <Sidebar />
          </aside>
          <main className="flex-1 overflow-y-auto bg-background p-0">
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
