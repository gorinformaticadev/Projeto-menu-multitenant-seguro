"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  type ModuleMenu,
  type NavigationGroupDefinition,
  type NavigationModel,
  moduleRegistry,
} from "@/lib/module-registry";
import { resolveNavigationIcon } from "@/lib/navigation-icons";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type SidebarEntry =
  | { type: "item"; item: ModuleMenu; order: number }
  | { type: "group"; group: NavigationGroupDefinition; order: number };

const EMPTY_NAVIGATION_MODEL: NavigationModel = {
  primaryItems: [],
  groups: [],
  mobileItems: [],
  launcherItems: [],
};

function sortItems(items: ModuleMenu[]) {
  return [...items].sort((left, right) => (left.order ?? 999) - (right.order ?? 999));
}

export function Sidebar({ isExpanded }: { isExpanded: boolean }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [navigationModel, setNavigationModel] = useState<NavigationModel>(EMPTY_NAVIGATION_MODEL);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openNestedSections, setOpenNestedSections] = useState<Record<string, boolean>>({});
  const [openPopoverKey, setOpenPopoverKey] = useState<string | null>(null);
  const [openNestedPopoverKey, setOpenNestedPopoverKey] = useState<string | null>(null);

  const isRouteActive = useCallback(
    (route: string) => pathname === route || pathname.startsWith(`${route}/`),
    [pathname],
  );

  const isItemActive = useCallback(
    (item: ModuleMenu) =>
      isRouteActive(item.route) || Boolean(item.children?.some((child) => isRouteActive(child.route))),
    [isRouteActive],
  );

  const loadNavigation = useCallback(() => {
    try {
      setNavigationModel(moduleRegistry.getNavigationModel(user?.role));
    } catch (error) {
      console.error("Erro ao carregar navegacao do sidebar:", error);
      setNavigationModel(EMPTY_NAVIGATION_MODEL);
    }
  }, [user?.role]);

  useEffect(() => {
    loadNavigation();
  }, [loadNavigation]);

  useEffect(() => {
    const handleModuleStatusChanged = () => {
      loadNavigation();
    };

    window.addEventListener("moduleStatusChanged", handleModuleStatusChanged);
    return () => {
      window.removeEventListener("moduleStatusChanged", handleModuleStatusChanged);
    };
  }, [loadNavigation]);

  const entries = useMemo<SidebarEntry[]>(
    () =>
      [
        ...navigationModel.primaryItems.map((item) => ({
          type: "item" as const,
          item,
          order: item.order ?? 999,
        })),
        ...navigationModel.groups.map((group) => ({
          type: "group" as const,
          group,
          order: group.order,
        })),
      ].sort((left, right) => left.order - right.order),
    [navigationModel],
  );

  const mainEntries = useMemo(
    () =>
      entries.filter((entry) => entry.type === "item" || entry.group.placement !== "footer"),
    [entries],
  );

  const footerEntries = useMemo(
    () => entries.filter((entry) => entry.type === "group" && entry.group.placement === "footer"),
    [entries],
  );

  useEffect(() => {
    setOpenPopoverKey(null);
    setOpenNestedPopoverKey(null);
  }, [isExpanded, pathname]);

  useEffect(() => {
    const nextSections: Record<string, boolean> = {};
    const nextNestedSections: Record<string, boolean> = {};

    entries.forEach((entry) => {
      if (entry.type !== "group") {
        return;
      }

      if (entry.group.items.some((item) => isItemActive(item))) {
        nextSections[`group:${entry.group.id}`] = true;
      }

      entry.group.items.forEach((item) => {
        if (item.children?.length && isItemActive(item)) {
          nextNestedSections[`item:${item.id}`] = true;
        }
      });
    });

    setOpenSections((current) => ({ ...current, ...nextSections }));
    setOpenNestedSections((current) => ({ ...current, ...nextNestedSections }));
  }, [entries, isItemActive]);

  const closeAllPopovers = () => {
    setOpenPopoverKey(null);
    setOpenNestedPopoverKey(null);
  };

  const renderNestedLinks = (item: ModuleMenu, onNavigate: () => void) => {
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
          const NestedIcon = resolveNavigationIcon(nestedItem.icon);

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

  const renderGroupList = (groupKey: string, items: ModuleMenu[]) =>
    sortItems(items).map((item) => {
      const Icon = resolveNavigationIcon(item.icon);
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
                Navegacao
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

  const renderExpandedGroup = (group: NavigationGroupDefinition) => {
    const sectionKey = `group:${group.id}`;
    const sectionOpen = openSections[sectionKey];
    const groupActive = group.items.some((item) => isItemActive(item));
    const GroupIcon = resolveNavigationIcon(group.icon);

    return (
      <div key={group.id} className="space-y-1">
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
          <GroupIcon className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1 truncate text-left">{group.name}</span>
          <ChevronDown
            className={cn("h-4 w-4 flex-shrink-0 transition-transform", sectionOpen && "rotate-180")}
          />
        </button>

        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-200",
            sectionOpen ? "max-h-[36rem] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="space-y-1 pl-3">
            {sortItems(group.items).map((item) => {
              const ItemIcon = resolveNavigationIcon(item.icon);
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
                    <ItemIcon className="h-4 w-4 flex-shrink-0" />
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
                    <ItemIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    <ChevronDown
                      className={cn("h-4 w-4 flex-shrink-0 transition-transform", itemOpen && "rotate-180")}
                    />
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

  const renderCollapsedGroup = (group: NavigationGroupDefinition, isFooter = false) => {
    const groupKey = `group:${group.id}`;
    const groupActive = group.items.some((item) => isItemActive(item));
    const GroupIcon = resolveNavigationIcon(group.icon);

    return (
      <Popover
        key={group.id}
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
            title={group.name}
            aria-label={`Abrir grupo ${group.name}`}
          >
            <GroupIcon className="h-5 w-5 flex-shrink-0" />
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
              Navegacao
            </p>
            <h3 className="mt-1 text-sm font-semibold text-skin-text">{group.name}</h3>
          </div>
          <div className="max-h-[calc(100vh-8rem)] space-y-1 overflow-y-auto p-3">
            {renderGroupList(groupKey, group.items)}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderEntry = (entry: SidebarEntry, isFooter = false) => {
    if (entry.type === "item") {
      const ItemIcon = resolveNavigationIcon(entry.item.icon);
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
          <ItemIcon className="h-5 w-5 flex-shrink-0" />
          {isExpanded && <span className="truncate">{entry.item.label}</span>}
        </Link>
      );
    }

    return isExpanded
      ? renderExpandedGroup(entry.group)
      : renderCollapsedGroup(entry.group, isFooter);
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
