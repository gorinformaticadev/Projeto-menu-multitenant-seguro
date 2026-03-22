/**
 * Module registry for the authenticated shell.
 *
 * Security contract:
 * - the API defines which modules are active
 * - the frontend does not invent permissions
 * - the frontend does organize shell navigation from one local authority
 */

import api, { API_URL } from "@/lib/api";
import { getConfigurationPanelItems } from "@/lib/configuration-menu";
import type {
  DashboardWidgetDefinition,
  FrontendModuleDefinition,
} from "@/lib/module-types";

const MODULE_REGISTRY_REQUEST_TIMEOUT_MS = 10000;
const MOBILE_NAV_PRIORITY = ["dashboard", "tenants", "users", "configuracoes"] as const;

export interface ModuleMenu {
  id?: string;
  label: string;
  icon?: string;
  route: string;
  order?: number;
  children?: ModuleMenu[];
  permission?: string;
  roles?: string[];
}

export interface ModuleData {
  slug: string;
  name: string;
  menus: ModuleMenu[];
  enabled?: boolean;
}

export interface ModulesResponse {
  modules: ModuleData[];
}

export interface ModuleUserMenuItem {
  id: string;
  label: string;
  icon?: string;
  href?: string;
  onClick?: () => void;
  order?: number;
}

export interface NavigationItemDefinition {
  id: string;
  label: string;
  href: string;
  icon?: string;
  order?: number;
}

export interface NavigationGroupDefinition {
  id: string;
  name: string;
  icon: string;
  order: number;
  placement: "main" | "footer";
  items: ModuleMenu[];
}

export interface NavigationModel {
  primaryItems: ModuleMenu[];
  groups: NavigationGroupDefinition[];
  mobileItems: NavigationItemDefinition[];
  launcherItems: Array<{ id: string; name: string; icon: string; href: string; order: number }>;
}

export const EMPTY_NAVIGATION_MODEL: NavigationModel = {
  primaryItems: [],
  groups: [],
  mobileItems: [],
  launcherItems: [],
};

export const NAVIGATION_MODEL_ERROR_CODE = "NAVIGATION_MODEL_UNAVAILABLE";
export const NAVIGATION_MODEL_ERROR_MESSAGE =
  "Nao foi possivel carregar a navegacao do sistema. Atualize a pagina para tentar novamente.";

export type NavigationModelResolution =
  | {
      status: "ready";
      model: NavigationModel;
      error: null;
    }
  | {
      status: "error";
      model: NavigationModel;
      error: {
        code: typeof NAVIGATION_MODEL_ERROR_CODE;
        message: string;
      };
    };

export type { DashboardWidgetDefinition };
export type ModuleDashboardWidget = DashboardWidgetDefinition & { module?: string };

const STATIC_GROUP_CONFIG: Record<
  string,
  Omit<NavigationGroupDefinition, "items">
> = {
  administration: {
    id: "administration",
    name: "Administracao",
    icon: "Shield",
    order: 20,
    placement: "footer",
  },
  sistema: {
    id: "sistema",
    name: "Sistema",
    icon: "Package",
    order: 50,
    placement: "main",
  },
  "demo-completo": {
    id: "demo-completo",
    name: "Demo Completo",
    icon: "Rocket",
    order: 60,
    placement: "main",
  },
  "module-exemplo": {
    id: "module-exemplo",
    name: "Module Exemplo",
    icon: "Package",
    order: 100,
    placement: "main",
  },
};

class ModuleRegistry {
  private static instance: ModuleRegistry;
  private apiModules: ModuleData[] = [];
  private codeDefinitions: Map<string, FrontendModuleDefinition> = new Map();
  private isLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }

    return ModuleRegistry.instance;
  }

  register(definition: FrontendModuleDefinition) {
    if (this.codeDefinitions.has(definition.id)) {
      console.warn(`[ModuleRegistry] Modulo ${definition.id} ja registrado. Ignorando duplicata.`);
      return;
    }

    this.codeDefinitions.set(definition.id, definition);
  }

  async loadModules(force = false): Promise<void> {
    if (this.isLoaded && !force) {
      return;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      try {
        const modulesEndpoint = API_URL === "/api" ? "/me/modules" : `${API_URL}/me/modules`;
        const response = await api.get<ModulesResponse>(modulesEndpoint, {
          timeout: MODULE_REGISTRY_REQUEST_TIMEOUT_MS,
        });

        this.apiModules = response.data.modules.filter((module) => module.enabled !== false);
        this.isLoaded = true;

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("moduleStatusChanged"));
        }
      } catch (error) {
        console.error("[ModuleRegistry] Erro ao carregar modulos da API:", error);
        this.apiModules = [];
        this.isLoaded = false;
        throw error;
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  getDashboardWidgets(): ModuleDashboardWidget[] {
    if (!this.isLoaded) {
      return [];
    }

    const widgets: ModuleDashboardWidget[] = [];

    for (const apiModule of this.apiModules) {
      const codeDefinition = this.codeDefinitions.get(apiModule.slug);

      if (codeDefinition?.widgets?.length) {
        widgets.push(
          ...codeDefinition.widgets.map((widget) => ({
            ...widget,
            module: apiModule.slug,
          })),
        );
        continue;
      }

      widgets.push({
        id: `${apiModule.slug}-widget-generic`,
        title: apiModule.name,
        type: "summary_card",
        component: "GenericModuleWidget",
        module: apiModule.slug,
        icon: "Package",
        gridSize: { w: 1, h: 1 },
      } as unknown as ModuleDashboardWidget);
    }

    return widgets.sort((left, right) => (left.order || 99) - (right.order || 99));
  }

  private filterMenusByAccess(menus: ModuleMenu[], userRole?: string): ModuleMenu[] {
    return menus
      .filter((menu) => {
        if (
          menu.permission &&
          menu.permission.includes("admin") &&
          userRole !== "ADMIN" &&
          userRole !== "SUPER_ADMIN"
        ) {
          return false;
        }

        if (menu.roles && Array.isArray(menu.roles) && userRole && !menu.roles.includes(userRole)) {
          return false;
        }

        return true;
      })
      .map((menu) => ({
        ...menu,
        id: menu.id || menu.route,
        children: menu.children ? this.filterMenusByAccess(menu.children, userRole) : undefined,
      }));
  }

  private getStaticPrimaryItems(): ModuleMenu[] {
    return [
      {
        id: "dashboard",
        label: "Dashboard",
        route: "/dashboard",
        icon: "LayoutDashboard",
        order: 1,
      },
    ];
  }

  private getAdministrationGroup(userRole?: string): NavigationGroupDefinition | null {
    if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return null;
    }

    const configurationChildren = getConfigurationPanelItems(userRole).map((item) => ({
      id: item.id,
      label: item.name,
      route: item.href,
      icon: item.icon,
      order: item.order,
    }));

    return {
      ...STATIC_GROUP_CONFIG.administration,
      items: [
        {
          id: "tenants",
          label: "Empresas",
          route: "/empresas",
          icon: "Building2",
          order: 10,
        },
        {
          id: "users",
          label: "Usuarios",
          route: "/usuarios",
          icon: "Users",
          order: 11,
        },
        {
          id: "configuracoes",
          label: "Configuracoes",
          route: "/configuracoes",
          icon: "Settings",
          order: 12,
          children: configurationChildren,
        },
      ],
    };
  }

  private getDynamicGroups(userRole?: string): NavigationGroupDefinition[] {
    const groups: NavigationGroupDefinition[] = [];

    for (const module of this.apiModules) {
      const items = this.filterMenusByAccess(module.menus || [], userRole)
        .map((menu) => ({
          ...menu,
          id: menu.id || menu.route,
          icon: menu.icon || "Menu",
        }))
        .sort((left, right) => (left.order ?? 999) - (right.order ?? 999));

      if (items.length === 0) {
        continue;
      }

      const configuredGroup = STATIC_GROUP_CONFIG[module.slug];
      const mainMenu =
        items.find((menu) => menu.label === module.name) ||
        items.find((menu) => menu.children && menu.children.length > 0) ||
        items[0];

      groups.push({
        id: module.slug,
        name: configuredGroup?.name || module.name,
        icon: configuredGroup?.icon || mainMenu?.icon || "Menu",
        order: configuredGroup?.order ?? 100,
        placement: configuredGroup?.placement ?? "main",
        items,
      });
    }

    return groups.sort((left, right) => left.order - right.order);
  }

  private buildMobileItems(
    primaryItems: ModuleMenu[],
    groups: NavigationGroupDefinition[],
  ): NavigationItemDefinition[] {
    const topLevelItems = [...primaryItems, ...groups.flatMap((group) => group.items)];
    const itemMap = new Map<string, NavigationItemDefinition>();

    for (const item of topLevelItems) {
      const id = String(item.id || item.route).trim();
      if (!id || itemMap.has(id)) {
        continue;
      }

      itemMap.set(id, {
        id,
        label: item.label,
        href: item.route,
        icon: item.icon,
        order: item.order,
      });
    }

    const prioritizedItems = MOBILE_NAV_PRIORITY.map((id) => itemMap.get(id)).filter(
      (item): item is NavigationItemDefinition => Boolean(item),
    );

    if (prioritizedItems.length > 0) {
      return prioritizedItems;
    }

    return [...itemMap.values()]
      .sort((left, right) => (left.order ?? 999) - (right.order ?? 999))
      .slice(0, 4);
  }

  private buildLauncherItems(userRole?: string): NavigationModel["launcherItems"] {
    if (!this.isLoaded) {
      return [];
    }

    return this.apiModules
      .map((module) => {
        const items = this.filterMenusByAccess(module.menus || [], userRole);
        const mainMenu = items[0];

        if (!mainMenu) {
          return null;
        }

        return {
          id: `taskbar-${module.slug}`,
          name: mainMenu.label || module.name,
          icon: mainMenu.icon || "Package",
          href: mainMenu.route,
          order: mainMenu.order || 50,
        };
      })
      .filter(
        (item): item is { id: string; name: string; icon: string; href: string; order: number } =>
          Boolean(item),
      )
      .sort((left, right) => (left.order || 99) - (right.order || 99));
  }

  getNavigationModel(userRole?: string): NavigationModel {
    const primaryItems = this.getStaticPrimaryItems();
    const adminGroup = this.getAdministrationGroup(userRole);
    const groups = [
      ...(adminGroup ? [adminGroup] : []),
      ...this.getDynamicGroups(userRole),
    ];

    return {
      primaryItems,
      groups,
      mobileItems: this.buildMobileItems(primaryItems, groups),
      launcherItems: this.buildLauncherItems(userRole),
    };
  }

  resolveNavigationModel(userRole?: string): NavigationModelResolution {
    try {
      return {
        status: "ready",
        model: this.getNavigationModel(userRole),
        error: null,
      };
    } catch (error) {
      console.error("[ModuleRegistry] Falha ao resolver o modelo de navegacao:", {
        userRole,
        error,
      });

      return {
        status: "error",
        model: EMPTY_NAVIGATION_MODEL,
        error: {
          code: NAVIGATION_MODEL_ERROR_CODE,
          message: NAVIGATION_MODEL_ERROR_MESSAGE,
        },
      };
    }
  }

  getSidebarItems(userRole?: string): ModuleMenu[] {
    return this.getNavigationModel(userRole).primaryItems;
  }

  getGroupedSidebarItems(userRole?: string): {
    ungrouped: ModuleMenu[];
    groups: Record<string, ModuleMenu[]>;
    groupOrder: string[];
  } {
    const navigationModel = this.getNavigationModel(userRole);

    return {
      ungrouped: navigationModel.primaryItems,
      groups: Object.fromEntries(
        navigationModel.groups.map((group) => [group.id, group.items]),
      ),
      groupOrder: navigationModel.groups.map((group) => group.id),
    };
  }

  getAllMenus(): ModuleMenu[] {
    const allMenus: ModuleMenu[] = [];

    for (const module of this.apiModules) {
      if (module.menus?.length) {
        allMenus.push(...module.menus);
      }
    }

    return allMenus;
  }

  getTaskbarItems(userRole?: string): NavigationModel["launcherItems"] {
    return this.getNavigationModel(userRole).launcherItems;
  }

  getUserMenuItems(userRole?: string): ModuleUserMenuItem[] {
    if (!this.isLoaded) {
      return [];
    }

    const userMenuItems: ModuleUserMenuItem[] = [];

    for (const module of this.apiModules) {
      const menus = this.filterMenusByAccess(module.menus || [], userRole);

      for (const menu of menus) {
        if (menu.children?.length) {
          continue;
        }

        userMenuItems.push({
          id: `usermenu-${module.slug}-${menu.id || menu.route}`,
          label: menu.label,
          icon: menu.icon,
          href: menu.route,
          order: menu.order || 50,
        });
      }
    }

    return userMenuItems.sort((left, right) => (left.order || 99) - (right.order || 99));
  }

  hasModule(slug: string): boolean {
    return this.apiModules.some((module) => module.slug === slug);
  }

  getModule(slug: string): ModuleData | undefined {
    return this.apiModules.find((module) => module.slug === slug);
  }

  getAvailableModules(): string[] {
    return this.apiModules.map((module) => module.slug);
  }

  getModuleMenus(slug: string): ModuleMenu[] {
    const module = this.getModule(slug);
    return module?.menus || [];
  }
}

export const moduleRegistry = ModuleRegistry.getInstance();
