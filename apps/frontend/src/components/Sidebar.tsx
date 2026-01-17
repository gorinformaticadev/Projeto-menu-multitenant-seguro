"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, Settings, LogOut, ChevronLeft, User, Menu, Shield, FileText, HelpCircle, Package, Home, BookOpen, Rocket, BarChart3, FolderKanban, Tags } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Button } from "./ui/button";
// @ts-ignore - moduleRegistry é válido
import { moduleRegistry } from "@/lib/module-registry";

// Interface local para itens de menu
interface ModuleMenuItem {
  id: string;
  name: string;
  href: string;
  icon: string;
  order: number;
}

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
  BookOpen,
  Rocket,
  BarChart3,
  FolderKanban,
  Tags,
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
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

  // Escuta mudanças no status dos módulos
  useEffect(() => {
    const handleModuleStatusChange = () => {
      loadMenuItems();
    };

    window.addEventListener('moduleStatusChanged', handleModuleStatusChange);
    return () => {
      window.removeEventListener('moduleStatusChanged', handleModuleStatusChange);
    };
  }, []);

  // Recolhe o sidebar quando a rota muda (especialmente útil em mobile)
  useEffect(() => {
    if (isExpanded) {
      setIsExpanded(false);
    }
  }, [pathname]); // Dependência no pathname para reagir a mudanças de rota

  const loadMenuItems = () => {
    try {
      // Core agrega itens de todos os módulos registrados
      const grouped = moduleRegistry.getGroupedSidebarItems(user?.role);

      // console.log('📋 [Sidebar] Itens agrupados recebidos:', {
      //   ungrouped: grouped.ungrouped.length,
      //   groups: Object.keys(grouped.groups),
      //   groupOrder: grouped.groupOrder,
      //   detalhes: grouped
      // });

      setGroupedItems(grouped);

      const totalItems = grouped.ungrouped.length + Object.values(grouped.groups).flat().length;
      // console.log('📋 Itens do menu carregados:', totalItems);
      // console.log('📋 Grupos encontrados:', Object.keys(grouped.groups));
    } catch (error) {
      console.warn('⚠️ Erro ao carregar itens do menu, usando menu básico:', error);

      // Em caso de erro, carrega menu básico do CORE
      const basicItems = [
        {
          id: 'dashboard',
          name: 'Dashboard',
          href: '/dashboard',
          icon: 'LayoutDashboard',
          order: 1
        }
      ];

      // Adiciona itens administrativos se for ADMIN/SUPER_ADMIN
      if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
        basicItems.push(
          {
            id: 'tenants',
            name: 'Empresas',
            href: '/empresas',
            icon: 'Building2',
            order: 10
          },
          {
            id: 'users',
            name: 'Usuários',
            href: '/usuarios',
            icon: 'Users',
            order: 11
          },
          {
            id: 'configuracoes',
            name: 'Configurações',
            href: '/configuracoes',
            icon: 'Settings',
            order: 12
          }
        );
      }

      setGroupedItems({ ungrouped: basicItems, groups: {}, groupOrder: [] });
    }
  };

  // Função para alternar expansão de grupos (comportamento accordion)
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const isCurrentlyExpanded = prev[groupId];

      if (isCurrentlyExpanded) {
        // Se o grupo atual está expandido, apenas o recolhe
        return {
          ...prev,
          [groupId]: false
        };
      } else {
        // Se o grupo atual está recolhido, recolhe todos os outros e expande este
        const newState: Record<string, boolean> = {};

        // Recolhe todos os grupos
        Object.keys(prev).forEach(key => {
          newState[key] = false;
        });

        // Expande apenas o grupo clicado
        newState[groupId] = true;

        return newState;
      }
    });
  };

  // Função para lidar com clique em item de navegação
  const handleItemClick = () => {
    // Recolhe o sidebar quando um item é clicado (exceto grupos expansíveis)
    if (isExpanded) {
      setIsExpanded(false);
    }
  };

  // Configuração dos grupos
  const groupConfig: Record<string, { name: string; icon: any; order: number }> = {
    administration: {
      name: 'Administração',
      icon: Settings,
      order: 2 // Logo após Dashboard (ordem 1)
    },
    sistema: {
      name: 'Sistema',
      icon: Package,
      order: 50 // Antes dos módulos personalizados
    },
    'module-exemplo': {
      name: 'Module Exemplo',
      icon: Package,
      order: 100 // Módulos começam na ordem 100+
    },
    'demo-completo': {
      name: 'Demo Completo',
      icon: Rocket,
      order: 15 // Após dashboard, antes de administração
    }
  };

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "flex flex-col h-full bg-gradient-to-b from-secondary to-background border-r border-border/40 shadow-xl z-20 transition-all duration-300 relative",
        isExpanded ? "w-56" : "w-16"
      )}
    >
      {/* Header */}
      {/* Controle de Toggle Minimalista (Float) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "absolute -right-3 top-0 z-50",
          "h-6 w-6 rounded-full flex items-center justify-center",
          "bg-background shadow-neu-sm hover:shadow-neu-flat",
          "text-muted-foreground hover:text-primary transition-all duration-300",
          "focus:outline-none border border-white/20" // Borda sutil para contraste
        )}
        title={isExpanded ? "Recolher" : "Expandir"}
      >
        <ChevronLeft className={cn("h-3 w-3 transition-transform", !isExpanded && "rotate-180")} />
      </button>

      {/* Espaçador Superior */}
      <div className="h-2" />

      {/* Navigation */}
      <div className="flex-1 p-1 overflow-y-auto">
        <nav className="space-y-1">
          {/* Renderiza todos os itens em ordem global: Dashboard -> Administração -> Módulos */}
          {(() => {
            const allRenderItems: React.JSX.Element[] = [];

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
              let config = groupConfig[groupId as keyof typeof groupConfig];

              // Fallback para módulos dinâmicos (não hardcoded)
              if (!config) {
                const moduleData = moduleRegistry.getModule(groupId);
                if (moduleData) {
                  // Estratégia para encontrar o ícone mais representativo:
                  // 1. Tenta encontrar um menu com o mesmo nome do módulo
                  // 2. Tenta encontrar um menu que tenha filhos (menu pai)
                  // 3. Fallback para o primeiro menu da lista
                  const menus = moduleData.menus || [];
                  const mainMenu = menus.find(m => m.label === moduleData.name) ||
                    menus.find(m => m.children && m.children.length > 0) ||
                    menus[0];

                  const iconName = mainMenu?.icon;

                  const DynamicIcon = iconName
                    ? (LucideIcons as any)[iconName] || Package
                    : Package;

                  config = {
                    name: moduleData.name,
                    icon: DynamicIcon,
                    order: 100
                  };
                }
              }

              if (config && items && items.length > 0) {
                // Usa a ordem do grupo definida na configuração
                const groupOrder = config.order || 999;
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
                    onClick={handleItemClick}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all duration-200 group relative",
                      isActive
                        ? "bg-primary/10 text-primary border-l-2 border-primary"
                        : "text-muted-foreground/70 hover:text-foreground hover:bg-white/5 hover:opacity-100",
                      !isExpanded && "justify-center px-0"
                    )}
                    title={!isExpanded ? item.name : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
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
                            "w-full justify-between px-3 py-2 text-sm font-medium transition-all duration-200",
                            "hover:text-primary hover:shadow-neu-flat",
                            hasActiveItem && "text-primary font-semibold"
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
                          <div className="pl-4 space-y-1 ml-4">
                            {items.filter((item: any) => item.name !== config.name).map((item: any) => {
                              const isActive = pathname === item.href;
                              const Icon = iconMap[item.icon] || Menu;

                              return (
                                <Link
                                  key={item.id}
                                  href={item.href}
                                  onClick={handleItemClick}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all duration-200 group relative",
                                    isActive
                                      ? "bg-primary/10 text-primary border-l-2 border-primary"
                                      : "text-muted-foreground/70 hover:text-foreground hover:bg-white/5 hover:opacity-100"
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
                        <div className="my-2" />
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setIsExpanded(true);
                            setExpandedGroups(prev => {
                              // Accordion: recolhe outros antes de expandir este
                              const newState: Record<string, boolean> = {};
                              Object.keys(prev).forEach(key => newState[key] = false);
                              newState[groupId] = true;
                              return newState;
                            });
                          }}
                          className={cn(
                            "w-full justify-center px-1 py-1 transition-all duration-200 hover:text-primary hover:shadow-neu-flat hover:-translate-y-0.5",
                            hasActiveItem && "text-primary shadow-neu-pressed hover:translate-y-0 hover:shadow-neu-pressed"
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
      <div className="p-1">
        <Button
          variant="ghost"
          className={cn(
            "w-full",
            isExpanded ? "justify-start" : "justify-center px-1"
          )}
          onClick={() => {
            handleItemClick(); // Recolhe o sidebar
            logout(); // Faz logout
          }}
          title={!isExpanded ? "Sair" : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {isExpanded && <span className="ml-3">Sair</span>}
        </Button>
      </div>
    </div>
  );
}
