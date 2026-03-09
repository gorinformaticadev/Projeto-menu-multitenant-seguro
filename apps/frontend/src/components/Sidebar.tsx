"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Menu,
  Shield,
  FileText,
  HelpCircle,
  Package,
  Home,
  BookOpen,
  Rocket,
  BarChart3,
  FolderKanban,
  Tags,
  Blocks,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Button } from "./ui/button";

import { moduleRegistry } from "@/lib/module-registry";

interface ModuleMenuItem {
  id: string;
  label: string;
  route: string;
  icon: string;
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

interface OpenSubmenuState {
  triggerKey: string;
  title: string;
  items: ModuleMenuItem[];
}

interface SubmenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

interface ScrollHintState {
  canScrollUp: boolean;
  canScrollDown: boolean;
}

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
    icon: Settings,
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

function calculatePanelPosition(
  anchorRect: DOMRect,
  preferredLeft: number,
  panelHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): SubmenuPosition {
  const effectiveHeight = Math.min(panelHeight, viewportHeight - 32);
  const width = Math.min(304, viewportWidth - 32);
  const left = Math.max(16, Math.min(preferredLeft, viewportWidth - width - 16));
  const top = Math.max(16, Math.min(anchorRect.top - 4, viewportHeight - effectiveHeight - 16));

  return {
    top,
    left,
    width,
    maxHeight: viewportHeight - 32,
  };
}

function sortMenuItems(items: ModuleMenuItem[]): ModuleMenuItem[] {
  return [...items].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function getDirectSubmenuItems(items: ModuleMenuItem[]): ModuleMenuItem[] {
  return sortMenuItems(items);
}

function getGroupSubmenuItems(items: ModuleMenuItem[], title: string): ModuleMenuItem[] {
  const filteredItems = sortMenuItems(items).filter(
    (item) => item.label !== title || items.length === 1 || Boolean(item.children?.length),
  );

  if (filteredItems.length > 0) {
    return filteredItems;
  }

  return sortMenuItems(items);
}

function getDynamicGroupConfig(groupId: string): GroupConfig | null {
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

  const lucideIcons = LucideIcons as unknown as Record<string, React.ElementType>;
  const iconName = mainMenu?.icon;
  const DynamicIcon = iconName ? lucideIcons[iconName] || Package : Package;

  return {
    name: moduleData.name,
    icon: DynamicIcon,
    order: 100,
  };
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [groupedItems, setGroupedItems] = useState<GroupedItemsState>({
    ungrouped: [],
    groups: {},
    groupOrder: [],
  });
  const [openSubmenu, setOpenSubmenu] = useState<OpenSubmenuState | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<SubmenuPosition | null>(null);
  const [nestedSubmenu, setNestedSubmenu] = useState<OpenSubmenuState | null>(null);
  const [nestedSubmenuPosition, setNestedSubmenuPosition] = useState<SubmenuPosition | null>(null);
  const [submenuHeight, setSubmenuHeight] = useState<number | null>(null);
  const [nestedSubmenuHeight, setNestedSubmenuHeight] = useState<number | null>(null);
  const [submenuScrollHint, setSubmenuScrollHint] = useState<ScrollHintState>({
    canScrollUp: false,
    canScrollDown: false,
  });
  const [nestedSubmenuScrollHint, setNestedSubmenuScrollHint] = useState<ScrollHintState>({
    canScrollUp: false,
    canScrollDown: false,
  });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const submenuPanelRef = useRef<HTMLDivElement>(null);
  const nestedSubmenuPanelRef = useRef<HTMLDivElement>(null);
  const submenuScrollRef = useRef<HTMLDivElement>(null);
  const nestedSubmenuScrollRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | HTMLAnchorElement | null>>({});
  const submenuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  const closeSubmenu = useCallback(() => {
    setOpenSubmenu(null);
    setSubmenuPosition(null);
    setNestedSubmenu(null);
    setNestedSubmenuPosition(null);
    setSubmenuHeight(null);
    setNestedSubmenuHeight(null);
    setSubmenuScrollHint({ canScrollUp: false, canScrollDown: false });
    setNestedSubmenuScrollHint({ canScrollUp: false, canScrollDown: false });
  }, []);

  const setTriggerRef = useCallback(
    (triggerKey: string, element: HTMLButtonElement | HTMLAnchorElement | null) => {
      triggerRefs.current[triggerKey] = element;
    },
    [],
  );

  const setSubmenuTriggerRef = useCallback((triggerKey: string, element: HTMLButtonElement | null) => {
    submenuTriggerRefs.current[triggerKey] = element;
  }, []);

  const updateSubmenuPosition = useCallback((triggerKey: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const triggerElement = triggerRefs.current[triggerKey];
    if (!triggerElement) {
      return;
    }

    const triggerRect = triggerElement.getBoundingClientRect();
    const sidebarRect = sidebarRef.current?.getBoundingClientRect();
    const panelHeight = submenuPanelRef.current?.offsetHeight ?? 360;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const preferredLeft = (sidebarRect?.right ?? triggerRect.right) + 12;
    setSubmenuPosition(
      calculatePanelPosition(triggerRect, preferredLeft, panelHeight, viewportWidth, viewportHeight),
    );
  }, []);

  const updateNestedSubmenuPosition = useCallback((triggerKey: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const triggerElement = submenuTriggerRefs.current[triggerKey];
    if (!triggerElement) {
      return;
    }

    const triggerRect = triggerElement.getBoundingClientRect();
    const parentRect = submenuPanelRef.current?.getBoundingClientRect();
    const panelHeight = nestedSubmenuPanelRef.current?.offsetHeight ?? 320;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const preferredLeft = (parentRect?.right ?? triggerRect.right) + 10;
    const topAnchor = parentRect ? Math.min(triggerRect.top - 4, parentRect.top) : triggerRect.top - 4;
    const anchorRect = new DOMRect(
      triggerRect.left,
      topAnchor,
      triggerRect.width,
      triggerRect.height,
    );

    setNestedSubmenuPosition(
      calculatePanelPosition(anchorRect, preferredLeft, panelHeight, viewportWidth, viewportHeight),
    );
  }, []);

  const updateScrollHintState = useCallback(
    (
      scrollElement: HTMLDivElement | null,
      setState: Dispatch<SetStateAction<ScrollHintState>>,
    ) => {
      if (!scrollElement) {
        setState({ canScrollUp: false, canScrollDown: false });
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const remainingScroll = scrollHeight - clientHeight - scrollTop;

      setState({
        canScrollUp: scrollTop > 4,
        canScrollDown: remainingScroll > 4,
      });
    },
    [],
  );

  const scrollPanelByStep = useCallback((scrollElement: HTMLDivElement | null, direction: "up" | "down") => {
    if (!scrollElement) {
      return;
    }

    const distance = Math.max(140, Math.round(scrollElement.clientHeight * 0.6));
    scrollElement.scrollBy({
      top: direction === "down" ? distance : -distance,
      behavior: "smooth",
    });
  }, []);

  const isFloatingPanelScrollTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Node)) {
      return false;
    }

    return Boolean(
      submenuScrollRef.current?.contains(target) ||
      nestedSubmenuScrollRef.current?.contains(target) ||
      submenuPanelRef.current?.contains(target) ||
      nestedSubmenuPanelRef.current?.contains(target),
    );
  }, []);

  const updateMeasuredPanelHeight = useCallback(
    (
      panelElement: HTMLDivElement | null,
      position: SubmenuPosition | null,
      setHeight: Dispatch<SetStateAction<number | null>>,
    ) => {
      if (!panelElement || !position) {
        setHeight(null);
        return;
      }

      const nextHeight = Math.min(panelElement.scrollHeight, position.maxHeight);
      setHeight((current) => (current === nextHeight ? current : nextHeight));
    },
    [],
  );

  const loadMenuItems = useCallback(() => {
    try {
      const grouped = moduleRegistry.getGroupedSidebarItems(user?.role);
      setGroupedItems(grouped as GroupedItemsState);
    } catch (error) {
      console.warn("⚠️ Erro ao carregar itens do menu, usando menu básico:", error);

      const basicItems: ModuleMenuItem[] = [
        {
          id: "dashboard",
          label: "Dashboard",
          route: "/dashboard",
          icon: "LayoutDashboard",
          order: 1,
        },
      ];

      if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
        basicItems.push(
          {
            id: "tenants",
            label: "Empresas",
            route: "/empresas",
            icon: "Building2",
            order: 10,
          },
          {
            id: "users",
            label: "Usuários",
            route: "/usuarios",
            icon: "Users",
            order: 11,
          },
          {
            id: "configuracoes",
            label: "Configurações",
            route: "/configuracoes",
            icon: "Settings",
            order: 12,
          },
        );
      }

      setGroupedItems({ ungrouped: basicItems, groups: {}, groupOrder: [] });
    }
  }, [user?.role]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedInsideSidebar = sidebarRef.current?.contains(target);
      const clickedInsideSubmenu = submenuPanelRef.current?.contains(target);
      const clickedInsideNestedSubmenu = nestedSubmenuPanelRef.current?.contains(target);

      if (!clickedInsideSidebar && !clickedInsideSubmenu && !clickedInsideNestedSubmenu) {
        if (isExpanded) {
          setIsExpanded(false);
        }
        closeSubmenu();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeSubmenu, isExpanded]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const timer = window.setTimeout(() => {
      loadMenuItems();
    }, 50);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadMenuItems, user]);

  useEffect(() => {
    const handleModuleStatusChange = () => {
      loadMenuItems();
    };

    window.addEventListener("moduleStatusChanged", handleModuleStatusChange);
    return () => {
      window.removeEventListener("moduleStatusChanged", handleModuleStatusChange);
    };
  }, [loadMenuItems]);

  useEffect(() => {
    closeSubmenu();
    setIsExpanded(false);
  }, [closeSubmenu, pathname]);

  useEffect(() => {
    if (!openSubmenu) {
      return;
    }

    const syncPosition = () => updateSubmenuPosition(openSubmenu.triggerKey);
    const frame = window.requestAnimationFrame(syncPosition);
    const handleWindowScroll = (event: Event) => {
      if (isFloatingPanelScrollTarget(event.target)) {
        return;
      }

      syncPosition();
    };

    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", handleWindowScroll, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", handleWindowScroll, true);
    };
  }, [isFloatingPanelScrollTarget, openSubmenu, updateSubmenuPosition]);

  useEffect(() => {
    if (!nestedSubmenu) {
      return;
    }

    const syncPosition = () => updateNestedSubmenuPosition(nestedSubmenu.triggerKey);
    const frame = window.requestAnimationFrame(syncPosition);
    const handleWindowScroll = (event: Event) => {
      if (isFloatingPanelScrollTarget(event.target)) {
        return;
      }

      syncPosition();
    };

    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", handleWindowScroll, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", handleWindowScroll, true);
    };
  }, [isFloatingPanelScrollTarget, nestedSubmenu, updateNestedSubmenuPosition]);

  useEffect(() => {
    if (!openSubmenu) {
      setSubmenuScrollHint({ canScrollUp: false, canScrollDown: false });
      setSubmenuHeight(null);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      updateMeasuredPanelHeight(submenuPanelRef.current, submenuPosition, setSubmenuHeight);
      updateScrollHintState(submenuScrollRef.current, setSubmenuScrollHint);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [openSubmenu, submenuPosition, updateMeasuredPanelHeight, updateScrollHintState]);

  useEffect(() => {
    if (!nestedSubmenu) {
      setNestedSubmenuScrollHint({ canScrollUp: false, canScrollDown: false });
      setNestedSubmenuHeight(null);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      updateMeasuredPanelHeight(nestedSubmenuPanelRef.current, nestedSubmenuPosition, setNestedSubmenuHeight);
      updateScrollHintState(nestedSubmenuScrollRef.current, setNestedSubmenuScrollHint);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [nestedSubmenu, nestedSubmenuPosition, updateMeasuredPanelHeight, updateScrollHintState]);

  const handleItemSelect = useCallback(() => {
    closeSubmenu();
    if (isExpanded) {
      setIsExpanded(false);
    }
  }, [closeSubmenu, isExpanded]);

  const openFloatingSubmenu = useCallback(
    (triggerKey: string, title: string, items: ModuleMenuItem[]) => {
      if (items.length === 0) {
        return;
      }

      setSubmenuPosition(null);
      setNestedSubmenu(null);
      setNestedSubmenuPosition(null);
      setOpenSubmenu((current) => {
        if (current?.triggerKey === triggerKey) {
          return null;
        }

        return {
          triggerKey,
          title,
          items,
        };
      });
    },
    [],
  );

  const openNestedFloatingSubmenu = useCallback(
    (triggerKey: string, title: string, items: ModuleMenuItem[]) => {
      if (items.length === 0) {
        return;
      }

      setNestedSubmenuPosition(null);
      setNestedSubmenu((current) => {
        if (current?.triggerKey === triggerKey) {
          return null;
        }

        return {
          triggerKey,
          title,
          items,
        };
      });
    },
    [],
  );

  const renderQueue = useMemo(() => {
    type RenderQueueItem =
      | { type: "item"; order: number; data: ModuleMenuItem }
      | {
          type: "group";
          order: number;
          data: { groupId: string; items: ModuleMenuItem[]; config: GroupConfig };
        };

    const queue: RenderQueueItem[] = [];

    groupedItems.ungrouped.forEach((item) => {
      queue.push({
        type: "item",
        order: item.order ?? 999,
        data: item,
      });
    });

    groupedItems.groupOrder.forEach((groupId) => {
      const items = groupedItems.groups[groupId];
      const config = getDynamicGroupConfig(groupId);

      if (config && items && items.length > 0) {
        queue.push({
          type: "group",
          order: config.order ?? 999,
          data: { groupId, items, config },
        });
      }
    });

    return queue.sort((a, b) => a.order - b.order);
  }, [groupedItems]);

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "relative z-20 flex h-full flex-col border-r border-border/80 bg-secondary shadow-[6px_0_24px_rgba(15,23,42,0.05)] transition-all duration-300 dark:shadow-[8px_0_28px_rgba(2,6,23,0.24)]",
        isExpanded ? "w-56" : "w-16",
      )}
    >
      <button
        onClick={() => {
          setIsExpanded((current) => !current);
          closeSubmenu();
        }}
        className={cn(
          "absolute -right-3 top-0 z-50",
          "flex h-6 w-6 items-center justify-center rounded-full border border-border/80 bg-card shadow-sm",
          "text-muted-foreground transition-all duration-300 hover:text-primary hover:shadow-md",
          "focus:outline-none",
        )}
        title={isExpanded ? "Recolher" : "Expandir"}
      >
        <ChevronLeft className={cn("h-3 w-3 transition-transform", !isExpanded && "rotate-180")} />
      </button>

      <div className="h-2" />

      <div className="flex-1 overflow-y-auto p-1">
        <nav className="space-y-1">
          {renderQueue.map((queueItem) => {
            if (queueItem.type === "item") {
              const item = queueItem.data;
              const submenuItems = item.children ? getDirectSubmenuItems(item.children) : [];
              const hasSubmenu = submenuItems.length > 0;
              const triggerKey = `item:${item.id}`;
              const isSubmenuOpen = openSubmenu?.triggerKey === triggerKey;
              const isActive = hasSubmenu
                ? submenuItems.some((submenuItem) => isRouteActive(submenuItem.route))
                : isRouteActive(item.route);
              const Icon = resolveIcon(item.icon);

              if (hasSubmenu) {
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    ref={(element) => setTriggerRef(triggerKey, element)}
                    onClick={() => openFloatingSubmenu(triggerKey, item.label, submenuItems)}
                    aria-expanded={isSubmenuOpen}
                    aria-haspopup="menu"
                    className={cn(
                      "group h-auto w-full rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                      isExpanded ? "justify-between" : "justify-center px-0",
                      isActive || isSubmenuOpen
                        ? "border border-primary/15 bg-card text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-card/80 hover:text-foreground",
                    )}
                    title={!isExpanded ? item.label : undefined}
                  >
                    <span className={cn("flex items-center gap-2", !isExpanded && "justify-center")}>
                      <Icon className="h-5 w-5 flex-shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
                      {isExpanded && <span>{item.label}</span>}
                    </span>
                    {isExpanded && (
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 transition-transform",
                          isSubmenuOpen && "translate-x-0.5 text-primary",
                        )}
                      />
                    )}
                  </Button>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.route}
                  onClick={handleItemSelect}
                  className={cn(
                    "group relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "border border-primary/15 bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-card/80 hover:text-foreground",
                    !isExpanded && "justify-center px-0",
                  )}
                  title={!isExpanded ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
                  {isExpanded && <span>{item.label}</span>}
                </Link>
              );
            }

            const { groupId, items, config } = queueItem.data;
            const submenuItems = getGroupSubmenuItems(items, config.name);
            const triggerKey = `group:${groupId}`;
            const isSubmenuOpen = openSubmenu?.triggerKey === triggerKey;
            const hasActiveItem = submenuItems.some((item) => isRouteActive(item.route));

            return (
              <div key={groupId} className="pt-2">
                <Button
                  variant="ghost"
                  ref={(element) => setTriggerRef(triggerKey, element)}
                  onClick={() => openFloatingSubmenu(triggerKey, config.name, submenuItems)}
                  aria-expanded={isSubmenuOpen}
                  aria-haspopup="menu"
                  className={cn(
                    "group h-auto w-full rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                    isExpanded ? "justify-between" : "justify-center px-0",
                    hasActiveItem || isSubmenuOpen
                      ? "border border-primary/15 bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-card/80 hover:text-foreground",
                  )}
                  title={!isExpanded ? config.name : undefined}
                >
                  <span className={cn("flex items-center gap-3", !isExpanded && "justify-center")}>
                    <config.icon className="h-5 w-5 flex-shrink-0 opacity-80 transition-opacity group-hover:opacity-100" />
                    {isExpanded && <span>{config.name}</span>}
                  </span>
                  {isExpanded && (
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isSubmenuOpen && "translate-x-0.5 text-primary",
                      )}
                    />
                  )}
                </Button>
              </div>
            );
          })}
        </nav>
      </div>

      {openSubmenu && submenuPosition && (
        <div
          ref={submenuPanelRef}
          className="fixed z-50 hidden min-h-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_20px_45px_rgba(15,23,42,0.16)] md:flex md:flex-col dark:shadow-[0_22px_50px_rgba(2,6,23,0.45)]"
          style={{
            top: submenuPosition.top,
            left: submenuPosition.left,
            width: submenuPosition.width,
            height: submenuHeight ?? undefined,
            maxHeight: submenuPosition.maxHeight,
          }}
        >
          <div className="border-b border-border/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              Navegação
            </p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">{openSubmenu.title}</h3>
          </div>

          <div
            ref={submenuScrollRef}
            onScroll={() => updateScrollHintState(submenuScrollRef.current, setSubmenuScrollHint)}
            className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto p-2 pb-16"
          >
            {submenuScrollHint.canScrollUp && (
              <div className="pointer-events-none sticky top-0 z-10 -mx-2 -mt-2 mb-2 h-6 bg-gradient-to-b from-card via-card/90 to-transparent" />
            )}
            <div className="space-y-1">
              {openSubmenu.items.map((item) => {
                const Icon = resolveIcon(item.icon);
                const isActive = isRouteActive(item.route);
                const nestedItems = item.children ? getDirectSubmenuItems(item.children) : [];
                const hasNestedSubmenu = nestedItems.length > 0;
                const nestedTriggerKey = `submenu:${item.id}`;
                const isNestedOpen = nestedSubmenu?.triggerKey === nestedTriggerKey;

                if (hasNestedSubmenu) {
                  const hasNestedActiveItem = nestedItems.some((nestedItem) => isRouteActive(nestedItem.route));

                  return (
                    <Button
                      key={item.id}
                      variant="ghost"
                      ref={(element) => setSubmenuTriggerRef(nestedTriggerKey, element)}
                      onClick={() => openNestedFloatingSubmenu(nestedTriggerKey, item.label, nestedItems)}
                      aria-expanded={isNestedOpen}
                      aria-haspopup="menu"
                      className={cn(
                        "group flex h-auto w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        hasNestedActiveItem || isNestedOpen
                          ? "border border-primary/15 bg-primary/10 text-primary shadow-sm"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0 opacity-75 transition-opacity group-hover:opacity-100" />
                      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 flex-shrink-0 transition-transform",
                          isNestedOpen && "translate-x-0.5 text-primary",
                        )}
                      />
                    </Button>
                  );
                }

                return (
                  <Link
                    key={item.id}
                    href={item.route}
                    onClick={handleItemSelect}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "border border-primary/15 bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 opacity-75 transition-opacity group-hover:opacity-100" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {submenuScrollHint.canScrollDown && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-card via-card/95 to-transparent" />
            )}
          </div>

          {submenuScrollHint.canScrollDown && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => scrollPanelByStep(submenuScrollRef.current, "down")}
                className="pointer-events-auto h-9 w-9 rounded-full border-border/80 bg-card/95 text-muted-foreground shadow-md backdrop-blur hover:text-primary"
                aria-label="Ver mais itens do submenu"
              >
                <ChevronRight className="h-4 w-4 rotate-90" />
              </Button>
            </div>
          )}
        </div>
      )}

      {nestedSubmenu && nestedSubmenuPosition && (
        <div
          ref={nestedSubmenuPanelRef}
          className="fixed z-[60] hidden min-h-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_20px_45px_rgba(15,23,42,0.16)] md:flex md:flex-col dark:shadow-[0_22px_50px_rgba(2,6,23,0.45)]"
          style={{
            top: nestedSubmenuPosition.top,
            left: nestedSubmenuPosition.left,
            width: nestedSubmenuPosition.width,
            height: nestedSubmenuHeight ?? undefined,
            maxHeight: nestedSubmenuPosition.maxHeight,
          }}
        >
          <div className="border-b border-border/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              Navegação
            </p>
            <h3 className="mt-1 text-sm font-semibold text-foreground">{nestedSubmenu.title}</h3>
          </div>

          <div
            ref={nestedSubmenuScrollRef}
            onScroll={() => updateScrollHintState(nestedSubmenuScrollRef.current, setNestedSubmenuScrollHint)}
            className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto p-2 pb-16"
          >
            {nestedSubmenuScrollHint.canScrollUp && (
              <div className="pointer-events-none sticky top-0 z-10 -mx-2 -mt-2 mb-2 h-6 bg-gradient-to-b from-card via-card/90 to-transparent" />
            )}
            <div className="space-y-1">
              {nestedSubmenu.items.map((item) => {
                const Icon = resolveIcon(item.icon);
                const isActive = isRouteActive(item.route);

                return (
                  <Link
                    key={item.id}
                    href={item.route}
                    onClick={handleItemSelect}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "border border-primary/15 bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 opacity-75 transition-opacity group-hover:opacity-100" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {nestedSubmenuScrollHint.canScrollDown && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-card via-card/95 to-transparent" />
            )}
          </div>

          {nestedSubmenuScrollHint.canScrollDown && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => scrollPanelByStep(nestedSubmenuScrollRef.current, "down")}
                className="pointer-events-auto h-9 w-9 rounded-full border-border/80 bg-card/95 text-muted-foreground shadow-md backdrop-blur hover:text-primary"
                aria-label="Ver mais itens do submenu"
              >
                <ChevronRight className="h-4 w-4 rotate-90" />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="p-1">
        <Button
          variant="ghost"
          className={cn("w-full", isExpanded ? "justify-start" : "justify-center px-1")}
          onClick={() => {
            handleItemSelect();
            logout();
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
