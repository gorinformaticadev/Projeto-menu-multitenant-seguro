"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { getConfigurationPanelItems } from "@/lib/configuration-menu";
import {
  Building2,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  FileText,
  User,
} from "lucide-react";
import { Button } from "./ui/button";
import { moduleRegistry } from "@/lib/module-registry";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SidebarItem {
  id: string;
  name: string;
  href: string;
  icon: string;
  order: number;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsPopoverOpen, setIsSettingsPopoverOpen] = useState(false);

  const configurationItems = useMemo(
    () => getConfigurationPanelItems(user?.role),
    [user?.role],
  );

  const hasSettingsItems = configurationItems.length > 0;
  const isSettingsSectionActive = pathname.startsWith("/configuracoes");

  const loadMenuItems = useCallback(() => {
    try {
      const rawItems = moduleRegistry.getSidebarItems(user?.role);
      const items: SidebarItem[] = rawItems.map((item) => ({
        id: item.id || item.route || "unknown",
        name: item.label,
        href: item.route,
        icon: item.icon || "Menu",
        order: item.order || 99,
      }));
      setMenuItems(items);
    } catch (error) {
      console.error("Erro ao carregar itens do menu:", error);
      setMenuItems([
        {
          id: "dashboard",
          name: "Dashboard",
          href: "/dashboard",
          icon: "LayoutDashboard",
          order: 1,
        },
      ]);
    }
  }, [user?.role]);

  useEffect(() => {
    loadMenuItems();
  }, [loadMenuItems]);

  useEffect(() => {
    if (isSettingsSectionActive) {
      setIsSettingsOpen(true);
      setIsSettingsPopoverOpen(false);
    }
  }, [isSettingsSectionActive]);

  const renderSettingsLinks = (onNavigate?: () => void) => (
    <>
      <Link
        href="/configuracoes"
        onClick={onNavigate}
        className={cn(
          "flex items-center rounded-lg px-3 py-2 text-sm transition-colors",
          pathname === "/configuracoes"
            ? "bg-skin-primary/15 text-skin-primary"
            : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
        )}
      >
        Visao geral
      </Link>

      {hasSettingsItems &&
        configurationItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-skin-primary/15 text-skin-primary"
                  : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
              )}
              title={item.description}
            >
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
    </>
  );

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-skin-border/70 bg-skin-sidebar-background text-skin-sidebar-text shadow-sm transition-all duration-300",
        isExpanded ? "w-64" : "w-16",
      )}
    >
      <div className="flex-1 overflow-y-auto p-3">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = iconMap[item.icon] || Menu;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-skin-primary text-skin-text-inverse"
                    : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
                  !isExpanded && "justify-center",
                )}
                title={!isExpanded ? item.name : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {isExpanded && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-skin-border/70 p-3">
        {isExpanded ? (
          <div className="mb-1">
            <button
              type="button"
              onClick={() => setIsSettingsOpen((current) => !current)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isSettingsSectionActive
                  ? "bg-skin-primary text-skin-text-inverse"
                  : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
              )}
              aria-expanded={isSettingsOpen}
              aria-controls="sidebar-settings-submenu"
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1 truncate text-left">Configuracoes</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 flex-shrink-0 transition-transform",
                  isSettingsOpen && "rotate-180",
                )}
              />
            </button>

            <div
              id="sidebar-settings-submenu"
              className={cn(
                "overflow-hidden transition-[max-height,opacity] duration-200",
                isSettingsOpen ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0",
              )}
            >
              <div className="mt-2 space-y-1 pl-3">
                {renderSettingsLinks()}
              </div>
            </div>
          </div>
        ) : (
          <Popover open={isSettingsPopoverOpen} onOpenChange={setIsSettingsPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "mb-1 flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isSettingsSectionActive
                    ? "bg-skin-primary text-skin-text-inverse"
                    : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
                )}
                title="Configuracoes"
                aria-label="Abrir submenu de configuracoes"
              >
                <Settings className="h-5 w-5 flex-shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-72 rounded-2xl border border-skin-border bg-skin-surface p-3 shadow-lg">
              <div className="mb-2 px-1">
                <p className="text-sm font-semibold text-skin-text">Configuracoes</p>
                <p className="text-xs text-skin-text-muted">Acesse diretamente as abas deste grupo.</p>
              </div>
              <div className="space-y-1">
                {renderSettingsLinks(() => setIsSettingsPopoverOpen(false))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <Button
          variant="ghost"
          className={cn("w-full", isExpanded ? "justify-start" : "justify-center px-2")}
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
