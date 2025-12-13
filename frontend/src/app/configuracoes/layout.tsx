"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { 
  Shield, 
  Building2, 
  Settings, 
  Download,
  Package,
  ChevronRight,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    {
      name: "Visão Geral",
      href: "/configuracoes",
      icon: Settings,
      description: "Configurações gerais do sistema",
      show: true,
    },
    {
      name: "Segurança",
      href: "/configuracoes/seguranca",
      icon: Shield,
      description: "Políticas de segurança e autenticação",
      show: user?.role === "SUPER_ADMIN",
    },
    {
      name: "Identidade da Plataforma",
      href: "/configuracoes/identidade",
      icon: Building2,
      description: "Informações básicas da plataforma",
      show: user?.role === "SUPER_ADMIN",
    },
    {
      name: "Gerenciamento de Módulos",
      href: "/configuracoes/sistema/modulos",
      icon: Package,
      description: "Instalar e gerenciar módulos",
      show: user?.role === "SUPER_ADMIN",
    },
    {
      name: "Sistema de Updates",
      href: "/configuracoes/sistema/updates",
      icon: Download,
      description: "Atualizações automáticas via Git",
      show: user?.role === "SUPER_ADMIN",
    },
    {
      name: "Configurações da Empresa",
      href: "/configuracoes/empresa",
      icon: Building2,
      description: "Informações da empresa",
      show: user?.role === "ADMIN",
    },
  ];

  const visibleItems = menuItems.filter(item => item.show);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-80 bg-card border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-lg font-semibold">Configurações</h2>
              <p className="text-sm text-muted-foreground">
                Gerencie o sistema
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex-1 p-6">
            <nav className="space-y-2">
              {visibleItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== "/configuracoes" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg text-sm transition-colors group",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{item.name}</div>
                      <div className={cn(
                        "text-xs truncate",
                        isActive 
                          ? "text-primary-foreground/80" 
                          : "text-muted-foreground"
                      )}>
                        {item.description}
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      "h-4 w-4 flex-shrink-0 transition-transform",
                      isActive ? "rotate-90" : "group-hover:translate-x-1"
                    )} />
                  </Link>
                );
              })}
            </nav>

            {/* Info Box */}
            <div className="mt-8 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Acesso Restrito</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {user?.role === "SUPER_ADMIN" 
                  ? "Você tem acesso completo a todas as configurações do sistema."
                  : "Algumas configurações são restritas a SUPER_ADMIN."
                }
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t">
            <div className="text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Usuário: {user?.name}</span>
                <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold">Configurações</h1>
          <div className="w-8" /> {/* Spacer */}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}