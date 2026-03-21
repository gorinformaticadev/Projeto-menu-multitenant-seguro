"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Blocks,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderKanban,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Rocket,
  Settings,
  Shield,
  Tags,
  User,
  Users,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { moduleRegistry } from "@/lib/module-registry";

interface ModuleMenuItem {
  id: string;
  label: string;
  route: string;
  icon?: string;
  order?: number;
  children?: ModuleMenuItem[];
}

interface GroupedItemsState {
  ungrouped: ModuleMenuItem[];
  groups: Record<string, ModuleMenuItem[]>;
  groupOrder: string[];
}

interface GroupConfig {
  name: string;
  icon: React.ElementType;
  order: number;
}

type SidebarEntry =
  | { type: "item"; item: ModuleMenuItem; order: number }
  | { type: "group"; groupId: string; items: ModuleMenuItem[]; config: GroupConfig; order: number };

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  Building2,
  Settings,
  User,
  Users,
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
  Blocks,
};

const groupConfig: Record<string, GroupConfig> = {
  administration: {
    name: "Administração",
    icon: Shield,
    order: 2,
  },
  sistema: {
    name: "Sistema",
    icon: Package,
    order: 50,
  },
  "module-exemplo": {
    name: "Module Exemplo",
    icon: Package,
    order: 100,
  },
  "demo-completo": {
    name: "Demo Completo",
    icon: Rocket,
    order: 15,
  },
};

const footerGroupIds = ["administration"];

function sortItems(items: ModuleMenuItem[]) {
  return [...items].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export function Sidebar({ isExpanded }: { isExpanded: boolean }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [groupedItems, setGroupedItems] = useState<GroupedItemsState>({
    ungrouped: [],
    groups: {},
    groupOrder: [],
  });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openNestedSections, setOpenNestedSections] = useState<Record<string, boolean>>({});
  const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
  const [openNestedPopoverKey, setOpenNestedPopoverKey] = useState<string | null>(null);

  const resolveIcon = useCallback((iconName?: string) => {
    const lucideIcons = LucideIcons as unknown as Record<string, React.ElementType>;
    if (!iconName) {
      return Menu;
    }

    return iconMap[iconName] || lucideIcons[iconName] || Menu;
  }, []);

  const isRouteActive = useCallback(
    (route: string) => pathname === route || pathname.startsWith(`${route}/`),
    [pathname],
  );

  const isItemActive = useCallback(
    (item: ModuleMenuItem) =>
      isRouteActive(item.route) || Boolean(item.children?.some((child) => isRouteActive(child.route))),
    [isRouteActive],
  );

  const getGroupConfig = useCallback((groupId: string): GroupConfig | null => {
    const configuredGroup = groupConfig[groupId];
    if (configuredGroup) {
      return configuredGroup;
    }

    const moduleData = moduleRegistry.getModule(groupId);
    if (!moduleData) {
      return null;
    }

    const menus = moduleData.menus || [];
    const mainMenu =
      menus.find((menu) => menu.label === moduleData.name) ||
      menus.find((menu) => menu.children && menu.children.length > 0) ||
      menus[0];

    return {
      name: moduleData.name,
      icon: resolveIcon(mainMenu?.icon),
      order: 100,
    };
  }, [resolveIcon]);

  const loadMenuItems = useCallback(() => {
    try {
      const nextItems = moduleRegistry.getGroupedSidebarItems(user?.role) as GroupedItemsState;
      setGroupedItems(nextItems);
    } catch (error) {
      console.error("Erro ao carregar itens do menu:", error);
      setGroupedItems({
        ungrouped: [
          {
            id: "dashboard",
            label: "Dashboard",
            route: "/dashboard",
            icon: "LayoutDashboard",
            order: 1,
          },
        ],
        groups: {},
        groupOrder: [],
      });
    }
  }, [user?.role]);

  useEffect(() => {
    loadMenuItems();
  }, [loadMenuItems]);

  useEffect(() => {
    const handleModuleStatusChanged = () => {
      loadMenuItems();
    };

    window.addEventListener("moduleStatusChanged", handleModuleStatusChanged);
    return () => {
      window.removeEventListener("moduleStatusChanged", handleModuleStatusChanged);
    };
  }, [loadMenuItems]);

  const entries = useMemo(() => {
    const nextEntries: SidebarEntry[] = groupedItems.ungrouped.map((item) => ({
      type: "item",
      item,
      order: item.order ?? 999,
    }));

    groupedItems.groupOrder.forEach((groupId) => {
      const config = getGroupConfig(groupId);
      const items = sortItems(groupedItems.groups[groupId] || []);
      if (!config || items.length === 0) {
        return;
      }

      nextEntries.push({
        type: "group",
        groupId,
        items,
        config,
        order: config.order,
      });
    });

    return nextEntries.sort((a, b) => a.order - b.order);
  }, [getGroupConfig, groupedItems]);

  const mainEntries = useMemo(
    () =>
      entries.filter((entry) => entry.type === "item" || !footerGroupIds.includes(entry.groupId)),
    [entries],
  );

  const footerEntries = useMemo(
    () => entries.filter((entry) => entry.type === "group" && footerGroupIds.includes(entry.groupId)),
    [entries],
  );

  useEffect(() => {
    setOpenPopoverKey(null);
    setOpenNestedPopoverKey(null);
  }, [isExpanded, pathname]);

  useEffect(() => {
    const nextSections: Record<string, boolean> = {};
    const nextNested: Record<string, boolean> = {};

    entries.forEach((entry) => {
      if (entry.type !== "group") {
        return;
      }

      if (entry.items.some((item) => isItemActive(item))) {
        nextSections[`group:${entry.groupId}`] = true;
      }

      entry.items.forEach((item) => {
        if (item.children?.length && isItemActive(item)) {
          nextNested[`item:${item.id}`] = true;
        }
      });
    });

    setOpenSections((current) => ({ ...current, ...nextSections }));
    setOpenNestedSections((current) => ({ ...current, ...nextNested }));
  }, [entries, isItemActive]);

  const closeAllPopovers = () => {
    setOpenPopoverKey(null);
    setOpenNestedPopoverKey(null);
  };

  const renderNestedLinks = (item: ModuleMenuItem, onNavigate: () => void) => {
    const nestedItems = sortItems(item.children || []);

    return (
      <>
        <Link
          href={item.route}
          onClick={onNavigate}
          className={cn(
            "flex items-center rounded-lg px-3 py-2 text-sm transition-colors",
            isRouteActive(item.route)
              ? "bg-skin-primary/15 text-skin-primary"
              : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
          )}
        >
          Visao geral
        </Link>
        {nestedItems.map((nestedItem) => {
          const NestedIcon = resolveIcon(nestedItem.icon);
          return (
            <Link
              key={nestedItem.id}
              href={nestedItem.route}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isRouteActive(nestedItem.route)
                  ? "bg-skin-primary/15 text-skin-primary"
                  : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
              )}
            >
              <NestedIcon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{nestedItem.label}</span>
            </Link>
          );
        })}
      </>
    );
  };

  const renderGroupList = (groupKey: string, items: ModuleMenuItem[]) =>
    sortItems(items).map((item) => {
      const Icon = resolveIcon(item.icon);
      const itemActive = isItemActive(item);

      if (!item.children?.length) {
        return (
          <Link
            key={item.id}
            href={item.route}
            onClick={closeAllPopovers}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              itemActive
                ? "border border-skin-primary/20 bg-skin-primary/10 text-skin-primary shadow-sm"
                : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      }

      const nestedKey = `${groupKey}:${item.id}`;

      return (
        <Popover
          key={item.id}
          open={openNestedPopoverKey === nestedKey}
          onOpenChange={(open) => setOpenNestedPopoverKey(open ? nestedKey : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                itemActive
                  ? "border border-skin-primary/20 bg-skin-primary/10 text-skin-primary shadow-sm"
                  : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={10}
            collisionPadding={16}
            className="w-72 overflow-hidden rounded-2xl border border-skin-border bg-skin-surface p-0 shadow-lg"
          >
            <div className="border-b border-skin-border/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-skin-text-muted/80">
                Navegação
              </p>
              <h3 className="mt-1 text-sm font-semibold text-skin-text">{item.label}</h3>
            </div>
            <div className="max-h-[calc(100vh-8rem)] space-y-1 overflow-y-auto p-3">
              {renderNestedLinks(item, closeAllPopovers)}
            </div>
          </PopoverContent>
        </Popover>
      );
    });

  const renderExpandedGroup = (groupId: string, config: GroupConfig, items: ModuleMenuItem[]) => {
    const sectionKey = `group:${groupId}`;
    const sectionOpen = openSections[sectionKey];
    const groupActive = items.some((item) => isItemActive(item));

    return (
      <div key={groupId} className="space-y-1">
        <button
          type="button"
          onClick={() =>
            setOpenSections((current) => ({ ...current, [sectionKey]: !current[sectionKey] }))
          }
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            groupActive
              ? "bg-skin-primary text-skin-text-inverse"
              : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
          )}
        >
          <config.icon className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1 truncate text-left">{config.name}</span>
          <ChevronDown className={cn("h-4 w-4 flex-shrink-0 transition-transform", sectionOpen && "rotate-180")} />
        </button>

        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-200",
            sectionOpen ? "max-h-[36rem] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="space-y-1 pl-3">
            {sortItems(items).map((item) => {
              const Icon = resolveIcon(item.icon);
              const itemKey = `item:${item.id}`;
              const itemOpen = openNestedSections[itemKey];
              const itemActive = isItemActive(item);

              if (!item.children?.length) {
                return (
                  <Link
                    key={item.id}
                    href={item.route}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      itemActive
                        ? "bg-skin-primary/15 text-skin-primary"
                        : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              }

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenNestedSections((current) => ({
                        ...current,
                        [itemKey]: !current[itemKey],
                      }))
                    }
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      itemActive
                        ? "bg-skin-primary/15 text-skin-primary"
                        : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    <ChevronDown className={cn("h-4 w-4 flex-shrink-0 transition-transform", itemOpen && "rotate-180")} />
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden transition-[max-height,opacity] duration-200",
                      itemOpen ? "max-h-[30rem] opacity-100" : "max-h-0 opacity-0",
                    )}
                  >
                    <div className="space-y-1 pl-3">{renderNestedLinks(item, closeAllPopovers)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderCollapsedGroup = (groupId: string, config: GroupConfig, items: ModuleMenuItem[], isFooter = false) => {
    const groupKey = `group:${groupId}`;
    const groupActive = items.some((item) => isItemActive(item));

    return (
      <Popover
        key={groupId}
        open={openPopoverKey === groupKey}
        onOpenChange={(open) => {
          setOpenPopoverKey(open ? groupKey : null);
          if (!open) {
            setOpenNestedPopoverKey(null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              groupActive
                ? "bg-skin-primary text-skin-text-inverse"
                : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
            )}
            title={config.name}
            aria-label={`Abrir grupo ${config.name}`}
          >
            <config.icon className="h-5 w-5 flex-shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align={isFooter ? "end" : "start"}
          sideOffset={12}
          collisionPadding={16}
          className="w-72 overflow-hidden rounded-2xl border border-skin-border bg-skin-surface p-0 shadow-lg"
        >
          <div className="border-b border-skin-border/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-skin-text-muted/80">
              Navegação
            </p>
            <h3 className="mt-1 text-sm font-semibold text-skin-text">{config.name}</h3>
          </div>
          <div className="max-h-[calc(100vh-8rem)] space-y-1 overflow-y-auto p-3">
            {renderGroupList(groupKey, items)}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderEntry = (entry: SidebarEntry, isFooter = false) => {
    if (entry.type === "item") {
      const Icon = resolveIcon(entry.item.icon);
      const active = isItemActive(entry.item);

      return (
        <Link
          key={entry.item.id}
          href={entry.item.route}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active
              ? "bg-skin-primary text-skin-text-inverse"
              : "text-skin-text-muted hover:bg-skin-menu-hover hover:text-skin-text",
            !isExpanded && "justify-center",
          )}
          title={!isExpanded ? entry.item.label : undefined}
        >
          <Icon className="h-5 w-5 flex-shrink-0" />
          {isExpanded && <span className="truncate">{entry.item.label}</span>}
        </Link>
      );
    }

    return isExpanded
      ? renderExpandedGroup(entry.groupId, entry.config, entry.items)
      : renderCollapsedGroup(entry.groupId, entry.config, entry.items, isFooter);
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-skin-border/70 bg-skin-sidebar-background text-skin-sidebar-text shadow-sm transition-all duration-300",
        isExpanded ? "w-64" : "w-16",
      )}
    >
      <div className="flex-1 overflow-y-auto p-3">
        <nav className="space-y-1">{mainEntries.map((entry) => renderEntry(entry))}</nav>
      </div>

      <div className="border-t border-skin-border/70 p-3">
        {footerEntries.length > 0 && (
          <nav className="mb-1 space-y-1">
            {footerEntries.map((entry) => renderEntry(entry, true))}
          </nav>
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
