"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { getConfigurationPanelItems } from "@/lib/configuration-menu";
import {
  Shield,
  BellRing,
  Building2,
  Settings,
  Download,
  Package,
  ChevronRight,
  Clock,
  Activity
} from "lucide-react";

const settingsIconMap = {
  Shield,
  BellRing,
  Building2,
  Settings,
  Download,
  Package,
  Clock,
  Activity,
};

export default function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = getConfigurationPanelItems(user?.role).map((item) => ({
    ...item,
    icon: settingsIconMap[item.icon as keyof typeof settingsIconMap] || Settings,
  }));

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Desktop Only */}
      <div className="hidden lg:block w-72 bg-card border-r h-full overflow-y-auto">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-8 border-b">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Painel</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">
                Configurações
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 p-6">
            <nav className="space-y-1.5">
              {visibleItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== "/configuracoes" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-2xl text-sm transition-all group",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-xl transition-colors",
                      isActive ? "bg-white/10" : "bg-slate-50 group-hover:bg-accent"
                    )}>
                      <Icon className="h-5 w-5 flex-shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold">{item.name}</div>
                    </div>
                    {!isActive && <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer Card */}
          <div className="p-6 border-t">
            <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-tighter">Segurança Ativa</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                {user?.role === "SUPER_ADMIN"
                  ? "Acesso Total habilitado para gerenciamento master."
                  : "Acesso administrativo limitado ao escopo da empresa."
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Mobile Title Barrier (Small indicator on sub-pages) */}
        {pathname !== "/configuracoes" && (
          <div className="lg:hidden flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-md sticky top-0 z-30">
            <Link href="/configuracoes" className="p-2 -ml-2 text-primary font-bold text-xs flex items-center gap-1">
              <ChevronRight className="h-4 w-4 rotate-180" />
              Voltar
            </Link>
            <h1 className="text-sm font-bold truncate px-4">
              {visibleItems.find(i => pathname.startsWith(i.href))?.name || "Configurações"}
            </h1>
            <div className="w-10" />
          </div>
        )}

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
