/**
 * MODULE REGISTRY - SISTEMA DE MÓDULOS FULL STACK
 *
 * PRINCÍPIO DE SEGURANÇA: Frontend NUNCA define módulos
 * Frontend apenas CONSUME dados da API
 *
 * REGRAS INEGOCIÁVEIS:
 * ❌ Frontend NÃO registra módulos
 * ❌ Frontend NÃO define menus
 * ❌ Frontend NÃO conhece permissões
 * ✅ Frontend consome /api/me/modules
 */

import api, { API_URL } from './api';
import { FrontendModuleDefinition, DashboardWidgetDefinition } from './module-types';

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

// Re-export compatible types
export type { DashboardWidgetDefinition };
export type ModuleDashboardWidget = DashboardWidgetDefinition & { module?: string };

/**
 * Registry Híbrido:
 * 1. Consome dados da API para saber o que está ATIVO e PERMITIDO
 * 2. Consome definições de código local para renderizar COMPONENTES
 */
class ModuleRegistry {
  private static instance: ModuleRegistry;
  private apiModules: ModuleData[] = []; // Dados da API (Estado)
  private codeDefinitions: Map<string, FrontendModuleDefinition> = new Map(); // Dados do Código (Comportamento)
  private isLoaded: boolean = false;

  private loadingPromise: Promise<void> | null = null;

  private constructor() { }

  static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  /**
   * Registra uma definição de módulo (Chamado pelo index.ts do módulo)
   */
  register(definition: FrontendModuleDefinition) {
    if (this.codeDefinitions.has(definition.id)) {
      console.warn(`[ModuleRegistry] Módulo ${definition.id} já registrado. Ignorando duplicata.`);
      return;
    }
    this.codeDefinitions.set(definition.id, definition);
    // console.log(`[ModuleRegistry] Definição de código registrada: ${definition.id}`);
  }

  /**
   * Carrega módulos da API (Chamado ao logar)
   * Prevents duplicate requests using a promise lock
   */
  async loadModules(force: boolean = false): Promise<void> {
    // Se já estiver carregado e não for forçado, retorna
    if (this.isLoaded && !force) return;

    // Se já houver uma requisição em andamento, retorna a promise dela
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = (async () => {
      try {
        const response = await api.get<ModulesResponse>(`${API_URL}/me/modules`);
        this.apiModules = response.data.modules.filter(m => m.enabled !== false);
        this.isLoaded = true;
        // console.log('✅ [ModuleRegistry] Módulos ativos carregados da API:', this.apiModules.length);

        // Disparar evento para componentes ouvirem
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('moduleStatusChanged'));
        }
      } catch (error) {
        console.error('❌ [ModuleRegistry] Erro ao carregar módulos da API:', error);
        this.apiModules = [];
        this.isLoaded = false;
        throw error; // Propagar erro para quem chamou saber
      } finally {
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  /**
   * Obtém widgets do dashboard misturando API (permissão) e Código (Renderização)
   */
  getDashboardWidgets(): ModuleDashboardWidget[] {
    if (!this.isLoaded) return [];

    const widgets: ModuleDashboardWidget[] = [];

    // Para cada módulo ativo na API
    for (const apiModule of this.apiModules) {
      const codeDef = this.codeDefinitions.get(apiModule.slug);

      // Se o módulo tem definição de código e widgets
      if (codeDef && codeDef.widgets && codeDef.widgets.length > 0) {
        // Usa os widgets ricos definidos no código
        widgets.push(...codeDef.widgets.map(w => ({ ...w, module: apiModule.slug })));
      } else {
        // Fallback: Gera widget genérico se não houver definição de código
        widgets.push({
          id: `${apiModule.slug}-widget-generic`,
          title: apiModule.name,
          type: 'summary_card',
          component: 'GenericModuleWidget', // String mágica tratada no renderizador
          module: apiModule.slug,
          icon: 'Package',
          gridSize: { w: 1, h: 1 }
        } as unknown as ModuleDashboardWidget);
      }
    }

    return widgets.sort((a, b) => (a.order || 99) - (b.order || 99));
  }

  /**
   * Métodos de compatibilidade mantidos
   */
  getSidebarItems(userRole?: string): ModuleMenu[] {
    // Mantém lógica antiga de menus vindos do JSON por enquanto
    // Idealmente migraria para codeDefinitions[slug].navItems
    return this.getGroupedSidebarItems(userRole).ungrouped;
  }

  getGroupedSidebarItems(userRole?: string): { ungrouped: ModuleMenu[]; groups: Record<string, ModuleMenu[]>; groupOrder: string[] } {
    // Lógica original preservada para Sidebar por enquanto
    const coreItems: ModuleMenu[] = [
      { id: 'dashboard', label: 'Dashboard', route: '/dashboard', icon: 'LayoutDashboard', order: 1 }
    ];

    const adminItems: ModuleMenu[] = [];
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      adminItems.push(
        { id: 'tenants', label: 'Empresas', route: '/empresas', icon: 'Building2', order: 10 },
        { id: 'users', label: 'Usuários', route: '/usuarios', icon: 'Users', order: 11 },
        { id: 'configuracoes', label: 'Configurações', route: '/configuracoes', icon: 'Settings', order: 12 }
      );
    }

    const groups: Record<string, ModuleMenu[]> = {};
    const groupOrder: string[] = [];

    if (adminItems.length > 0) {
      groups['administration'] = adminItems;
      groupOrder.push('administration');
    }

    // Adiciona grupos baseados na API (menus dinâmicos)
    for (const mod of this.apiModules) {
      if (mod.menus && mod.menus.length > 0) {
        const items = mod.menus.filter(m => {
          // 🛡️ Filtro de Segurança Simplificado
          // Se o menu requer permissão 'admin' e o usuário é USER, oculta
          if (m.permission && m.permission.includes('admin') && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
            return false;
          }
          // Se o menu tem roles definidas (compatibilidade futura)
          if (m.roles && Array.isArray(m.roles) && userRole && !m.roles.includes(userRole)) {
            return false;
          }
          return true;
        }).map(m => ({
          id: m.id || m.route,
          label: m.label,
          route: m.route,
          icon: m.icon || 'Menu',
          order: m.order,
          children: m.children
        }));

        if (items.length > 0) {
          groups[mod.slug] = items;
          groupOrder.push(mod.slug);
        } else {
          // DEBUG: Se todos os itens foram filtrados (ex: por permissão), 
          // NÃO adiciona o grupo nem a ordem, efetivamente ocultando o módulo do menu.
        }
      }
    }

    return { ungrouped: coreItems, groups, groupOrder };
  }

  // Backwards compatibility methods
  getAllMenus(): ModuleMenu[] {
    const allMenus: ModuleMenu[] = [];
    for (const mod of this.apiModules) {
      if (mod.menus && mod.menus.length > 0) {
        allMenus.push(...mod.menus);
      }
    }
    return allMenus;
  }

  /**
   * Retorna itens da taskbar baseado nos módulos ativos
   * Taskbar = atalhos rápidos para funcionalidades principais
   */
  getTaskbarItems(_userRole?: string): Array<{ id: string; name: string; icon: string; href: string; order: number }> {
    if (!this.isLoaded) return [];

    const taskbarItems: Array<{ id: string; name: string; icon: string; href: string; order: number }> = [];

    // Para cada módulo ativo, verificar se tem menus marcados para taskbar
    for (const mod of this.apiModules) {
      if (mod.menus && mod.menus.length > 0) {
        // Pega o primeiro menu de cada módulo para a taskbar
        const mainMenu = mod.menus[0];
        taskbarItems.push({
          id: `taskbar-${mod.slug}`,
          name: mainMenu.label || mod.name,
          icon: mainMenu.icon || 'Package',
          href: mainMenu.route,
          order: mainMenu.order || 50
        });
      }
    }

    return taskbarItems.sort((a, b) => (a.order || 99) - (b.order || 99));
  }

  /**
   * Retorna itens do menu do usuário baseado nos módulos ativos
   * User Menu = menu dropdown no canto superior direito
   */
  getUserMenuItems(_userRole?: string): ModuleUserMenuItem[] {
    if (!this.isLoaded) return [];

    const userMenuItems: ModuleUserMenuItem[] = [];

    // Para cada módulo ativo, adicionar seus menus principais ao user menu
    for (const mod of this.apiModules) {
      if (mod.menus && mod.menus.length > 0) {
        for (const menu of mod.menus) {
          // Adiciona menus de nível superior (sem children ou menus principais)
          if (!menu.children || menu.children.length === 0) {
            userMenuItems.push({
              id: `usermenu-${mod.slug}-${menu.id || menu.route}`,
              label: menu.label,
              icon: menu.icon,
              href: menu.route,
              order: menu.order || 50
            });
          }
        }
      }
    }

    return userMenuItems.filter(item => {
      // Fallback de segurança para user menu
      const apiModule = this.apiModules.find(m => m.slug === item.id.split('-')[1]);
      const menus = apiModule?.menus || [];
      const menuConfig = menus.find(m => m.route === item.href);

      if (menuConfig?.permission?.includes('admin') && _userRole !== 'ADMIN' && _userRole !== 'SUPER_ADMIN') {
        return false;
      }
      return true;
    }).sort((a, b) => (a.order || 99) - (b.order || 99));
  }

  hasModule(slug: string): boolean {
    return this.apiModules.some(m => m.slug === slug);
  }

  getModule(slug: string): ModuleData | undefined {
    return this.apiModules.find(m => m.slug === slug);
  }

  // Compatibility methods for useModulesManager hook
  getAvailableModules(): string[] {
    return this.apiModules.map(m => m.slug);
  }

  getModuleMenus(slug: string): ModuleMenu[] {
    const mod = this.getModule(slug);
    return mod?.menus || [];
  }
}

export const moduleRegistry = ModuleRegistry.getInstance();