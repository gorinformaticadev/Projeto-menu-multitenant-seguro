"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, Settings, LogOut, User, Menu, Shield, FileText } from "lucide-react";
import { Button } from "./ui/button";
import { moduleRegistry } from "@/lib/module-registry";

interface SidebarItem {
  id: string;
  name: string;
  href: string;
  icon: string;
  order: number;
}

// Mapeamento de ícones para componentes Lucide
const iconMap: Record<string, React.ComponentType> = {
  LayoutDashboard,
  Building2,
  Settings,
  User,
  FileText,
  Shield,
  Menu,
};

interface SidebarProps {
  isExpanded: boolean;
}

export function Sidebar({ isExpanded }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [menuItems, setMenuItems] = useState<SidebarItem[]>([]);

  // Carrega itens do menu do Module Registry
  useEffect(() => {
    loadMenuItems();
  }, [user]);

  const loadMenuItems = () => {
    try {
      // Core agrega itens de todos os módulos registrados
      const rawItems = moduleRegistry.getSidebarItems(user?.role);
      const items: SidebarItem[] = rawItems.map(item => ({
        id: item.id || item.route || 'unknown',
        name: item.label,
        href: item.route,
        icon: item.icon || 'Menu',
        order: item.order || 99
      }));
      setMenuItems(items);
    } catch (error) {
      console.error('Erro ao carregar itens do menu:', error);
      // Em caso de erro, carrega menu básico
      setMenuItems([
        {
          id: 'dashboard',
          name: 'Dashboard',
          href: '/dashboard',
          icon: 'LayoutDashboard',
          order: 1
        }
      ]);
    }
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-skin-border/70 bg-skin-sidebar-background text-skin-sidebar-text shadow-sm transition-all duration-300",
        isExpanded ? "w-56" : "w-16"
      )}
    >
      {/* Navigation */}
      <div className="flex-1 p-3">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = (iconMap[item.icon] || Menu) as any; // Fallback para ícone padrão

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-skin-primary text-skin-text-inverse"
                    : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
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

      <div className="border-t p-3">
        <Link
          href="/configuracoes"
          className={cn(
            "mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/configuracoes")
              ? "bg-skin-primary text-skin-text-inverse"
              : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
            !isExpanded && "justify-center",
          )}
          title={!isExpanded ? "Configuracoes" : undefined}
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          {isExpanded && <span>Configuracoes</span>}
        </Link>

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
