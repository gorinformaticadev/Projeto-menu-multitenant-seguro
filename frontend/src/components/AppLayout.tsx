"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Páginas onde o sidebar e topbar NÃO devem aparecer
  const publicPages = ["/", "/login", "/esqueci-senha", "/redefinir-senha"];
  const isPublicPage = publicPages.includes(pathname);

  // Se está carregando ou é página pública, não mostra sidebar nem topbar
  if (loading || isPublicPage || !user) {
    return <>{children}</>;
  }

  // Mostra topbar e sidebar fixos em todas as outras páginas
  return (
    <div className="flex h-screen overflow-hidden">
      {/* TopBar Fixa */}
      <TopBar />
      
      {/* Layout com Sidebar e Conteúdo */}
      <div className="flex w-full pt-16">
        <aside className="flex-shrink-0 h-[calc(100vh-4rem)]">
          <Sidebar />
        </aside>
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
