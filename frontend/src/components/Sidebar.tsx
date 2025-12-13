"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleMenus } from "@/hooks/useModuleMenus";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, Settings, LogOut, ChevronLeft, User, Menu, Shield, FileText, HelpCircle } from "lucide-react";
import { Button } from "./ui/button";

// Função para mapear nomes de ícones para componentes
const getIconComponent = (iconName: string): React.ComponentType<any> => {
  const iconMap: Record<string, React.ComponentType<any>> = {
    'LayoutDashboard': LayoutDashboard,
    'Building2': Building2,
    'Settings': Settings,
    'User': User,
    'Shield': Shield,
    'FileText': FileText,
    'HelpCircle': HelpCircle,
    'default': HelpCircle, // Ícone padrão
  };

  return iconMap[iconName] || iconMap['default'];
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { menus: moduleMenus, loading: moduleMenusLoading } = useModuleMenus();
  const [isExpanded, setIsExpanded] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Recolhe o menu ao clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isExpanded &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExpanded]);

  // Admin Group items
  const adminItems = [
    {
      name: "Empresas",
      href: "/empresas",
      icon: Building2,
      show: user?.role === "SUPER_ADMIN",
    },
    {
      name: "Usuários",
      href: "/usuarios",
      icon: User,
      show: user?.role === "SUPER_ADMIN" || user?.role === "ADMIN",
    },
    {
      name: "Logs de Auditoria",
      href: "/logs",
      icon: FileText,
      show: user?.role === "SUPER_ADMIN",
    },
    {
      name: "Configurações",
      href: "/configuracoes",
      icon: Settings,
      show: user?.role === "SUPER_ADMIN" || user?.role === "ADMIN",
    },
  ];

  // Adicionar menus dos módulos
  const moduleMenuItems = moduleMenus.map(menu => ({
    name: (menu as any).label || menu.name,
    href: menu.path, // Pode ser undefined se tiver filhos
    icon: getIconComponent(menu.icon),
    show: true,
    position: (menu as any).position || 99,
    children: menu.children,
  }));

  // Ordenar módulos por posição
  const sortedModules = [...moduleMenuItems].sort((a, b) => a.position - b.position);

  // Estado para controlar expansão do grupo Administração
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Estado para controlar expansão dos módulos (mapa de nomes)
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const toggleModule = (moduleName: string) => {
    setOpenModules(prev => ({
      ...prev,
      [moduleName]: !prev[moduleName]
    }));
    if (!isExpanded) setIsExpanded(true);
  };

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "flex flex-col h-full bg-card border-r transition-all duration-300",
        isExpanded ? "w-64" : "w-20"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-8 w-8"
        >
          {isExpanded ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 overflow-y-auto">
        <nav className="space-y-1">
          {/* 1. Dashboard (Always Top) */}
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === "/dashboard"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              !isExpanded && "justify-center"
            )}
            title={!isExpanded ? "Dashboard" : undefined}
          >
            <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
            {isExpanded && <span>Dashboard</span>}
          </Link>

          {/* 2. Administration Group (Now Second) */}
          <div className="py-2">
            {isExpanded ? (
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  onClick={() => setIsAdminOpen(!isAdminOpen)}
                  className="w-full justify-between px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5" />
                    <span>Administração</span>
                  </div>
                  <ChevronLeft className={cn("h-4 w-4 transition-transform", isAdminOpen ? "-rotate-90" : "rotate-180")} />
                </Button>

                {isAdminOpen && (
                  <div className="pl-4 space-y-1 border-l ml-4 border-border">
                    {/* Itens Fixos de Admin */}
                    {adminItems.map(item => {
                      if (!item.show) return null;
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              // Collapsed View for Administration
              <Button
                variant="ghost"
                onClick={() => {
                  setIsExpanded(true);
                  setIsAdminOpen(true);
                }}
                className="w-full justify-center px-2 py-2 hover:bg-accent hover:text-accent-foreground"
                title="Administração"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
          </div>

          <div className="my-2 border-t" />

          {/* 3. Modules (Sorted, below Admin) */}
          {sortedModules.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openModules[item.name] || false;

            // Se tiver filhos, renderiza como accordion
            if (hasChildren) {
              if (isExpanded) {
                return (
                  <div key={item.name} className="space-y-1">
                    <Button
                      variant="ghost"
                      onClick={() => toggleModule(item.name)}
                      className="w-full justify-between px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </div>
                      <ChevronLeft className={cn("h-4 w-4 transition-transform", isOpen ? "-rotate-90" : "rotate-180")} />
                    </Button>

                    {isOpen && (
                      <div className="pl-4 space-y-1 border-l ml-4 border-border">
                        {item.children!.map((child: any) => {
                          const ChildIcon = getIconComponent(child.icon);
                          const childPath = child.path || "#";
                          const isChildActive = pathname === childPath;

                          return (
                            <Link
                              key={child.name}
                              href={childPath}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                isChildActive
                                  ? "text-primary"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <ChildIcon className="h-4 w-4" />
                              <span>{child.label || child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              } else {
                // Collapsed view for module with children
                return (
                  <Button
                    key={item.name}
                    variant="ghost"
                    onClick={() => {
                      setIsExpanded(true);
                      toggleModule(item.name);
                    }}
                    className="w-full justify-center px-2 py-2 hover:bg-accent hover:text-accent-foreground"
                    title={item.name}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                  </Button>
                );
              }
            }

            // Se não tiver filhos, renderiza como link normal
            return (
              <Link
                key={item.href || item.name}
                href={item.href || '#'}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  !isExpanded && "justify-center"
                )}
                title={!isExpanded ? item.name : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {isExpanded && <span>{item.name}</span>}
              </Link>
            );
          })}

        </nav>
      </div>

      {/* Logout Button */}
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className={cn(
            "w-full",
            isExpanded ? "justify-start" : "justify-center px-2"
          )}
          onClick={logout}
          title={!isExpanded ? "Sair" : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {isExpanded && <span className="ml-3">Sair</span>}
        </Button>
      </div>
    </div>
  );
}
