"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, Settings, LogOut, ChevronLeft, User, Menu, Shield, FileText, HelpCircle, Package, Home } from "lucide-react";
import { Button } from "./ui/button";
import { moduleRegistry, ModuleMenuItem } from "@/lib/module-registry";

// Mapeamento de ícones para componentes Lucide
const iconMap: Record<string, any> = {
  LayoutDashboard,
  Building2,
  Settings,
  User,
  FileText,
  Shield,
  HelpCircle,
  Package,
  Home,
  Menu,
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuItems, setMenuItems] = useState<ModuleMenuItem[]>([]);
  const [groupedItems, setGroupedItems] = useState<{
    ungrouped: ModuleMenuItem[];
    groups: Record<string, ModuleMenuItem[]>;
    groupOrder: string[];
  }>({ ungrouped: [], groups: {}, groupOrder: [] });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
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

  // Carrega itens do menu do Module Registry
  useEffect(() => {
    loadMenuItems();
  }, [user]);

  const loadMenuItems = () => {
    try {
      // Core agrega itens de todos os módulos registrados
      const items = moduleRegistry.getSidebarItems(user?.role);
      const grouped = moduleRegistry.getGroupedSidebarItems(user?.role);
      
      setMenuItems(items);
      setGroupedItems(grouped);
      
      console.log('📋 Itens do menu carregados:', items.length);
      console.log('📋 Grupos encontrados:', Object.keys(grouped.groups));
    } catch (error) {
      console.error('❌ Erro ao carregar itens do menu:', error);
      // Em caso de erro, carrega menu básico
      const basicItems = [
        {
          id: 'dashboard',
          name: 'Dashboard',
          href: '/dashboard',
          icon: 'LayoutDashboard',
          order: 1
        }
      ];
      setMenuItems(basicItems);
      setGroupedItems({ ungrouped: basicItems, groups: {}, groupOrder: [] });
    }
  };

  // Função para alternar expansão de grupos
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Configuração dos grupos
  const groupConfig = {
    administration: {
      name: 'Administração',
      icon: Settings,
      order: 2 // Logo após Dashboard (ordem 1)
    },
    'module-exemplo': {
      name: 'Module Exemplo',
      icon: Package,
      order: 100 // Módulos começam na ordem 100+
    }
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
          {/* Renderiza todos os itens em ordem global: Dashboard -> Administração -> Módulos */}
          {(() => {
            const allRenderItems: JSX.Element[] = [];
            
            // Cria uma lista de todos os itens e grupos com suas ordens
            const renderQueue: Array<{
              type: 'item' | 'group';
              order: number;
              data: any;
            }> = [];

            // Adiciona itens não agrupados à fila
            groupedItems.ungrouped.forEach((item) => {
              renderQueue.push({
                type: 'item',
                order: item.order || 999,
                data: item
              });
            });

            // Adiciona grupos à fila
            groupedItems.groupOrder.forEach((groupId) => {
              const items = groupedItems.groups[groupId];
              const config = groupConfig[groupId as keyof typeof groupConfig];
              
              if (config && items && items.length > 0) {
                // Usa a ordem do primeiro item do grupo
                const groupOrder = items[0]?.order || 999;
                renderQueue.push({
                  type: 'group',
                  order: groupOrder,
                  data: { groupId, items, config }
                });
              }
            });

            // Ordena tudo pela ordem global
            renderQueue.sort((a, b) => a.order - b.order);

            // Renderiza na ordem correta
            renderQueue.forEach((queueItem) => {
              if (queueItem.type === 'item') {
                const item = queueItem.data;
                const isActive = pathname === item.href;
                const Icon = iconMap[item.icon] || Menu;

                allRenderItems.push(
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
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
              } else if (queueItem.type === 'group') {
                const { groupId, items, config } = queueItem.data;
                const isGroupExpanded = expandedGroups[groupId];
                const hasActiveItem = items.some((item: any) => pathname === item.href);

                allRenderItems.push(
                  <div key={groupId} className="pt-2">
                    {isExpanded ? (
                      <div className="space-y-1">
                        {/* Cabeçalho do grupo */}
                        <Button
                          variant="ghost"
                          onClick={() => toggleGroup(groupId)}
                          className={cn(
                            "w-full justify-between px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                            hasActiveItem && "text-primary"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <config.icon className="h-5 w-5" />
                            <span>{config.name}</span>
                          </div>
                          <ChevronLeft 
                            className={cn(
                              "h-4 w-4 transition-transform", 
                              isGroupExpanded ? "-rotate-90" : "rotate-180"
                            )} 
                          />
                        </Button>

                        {/* Itens do grupo */}
                        {isGroupExpanded && (
                          <div className="pl-4 space-y-1 border-l ml-4 border-border">
                            {items.map((item: any) => {
                              const isActive = pathname === item.href;
                              const Icon = iconMap[item.icon] || Menu;
                              
                              return (
                                <Link
                                  key={item.id}
                                  href={item.href}
                                  className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                    isActive
                                      ? "text-primary bg-accent"
                                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                  <span>{item.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      // Versão colapsada do grupo
                      <>
                        <div className="my-2 border-t" />
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setIsExpanded(true);
                            setExpandedGroups(prev => ({ ...prev, [groupId]: true }));
                          }}
                          className={cn(
                            "w-full justify-center px-2 py-2 hover:bg-accent hover:text-accent-foreground",
                            hasActiveItem && "text-primary bg-accent"
                          )}
                          title={config.name}
                        >
                          <config.icon className="h-5 w-5" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              }
            });

            return allRenderItems;
          })()}
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
