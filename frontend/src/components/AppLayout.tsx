"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Páginas onde o sidebar NÃO deve aparecer
  const publicPages = ["/", "/login"];
  const isPublicPage = publicPages.includes(pathname);

  // Se está carregando ou é página pública, não mostra sidebar
  if (loading || isPublicPage || !user) {
    return <>{children}</>;
  }

  // Mostra sidebar fixo em todas as outras páginas
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex-shrink-0 h-full">
        <Sidebar />
      </aside>
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
