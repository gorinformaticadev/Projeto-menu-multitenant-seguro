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

export interface ModuleMenu {
  id?: string;
  label: string;
  icon?: string;
  route: string;
  order?: number;
  children?: ModuleMenu[];
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

export interface ModuleNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  source: string;
  timestamp: Date;
}

export interface ModuleUserMenuItem {
  id: string;
  label: string;
  icon?: string;
  href?: string;
  onClick?: () => void;
  order?: number;
}

export interface ModuleDashboardWidget {
  id: string;
  title: string;
  component: any;
  module?: string;
  icon?: string;
  size?: 'small' | 'medium' | 'large';
  order?: number;
  permissions?: string[];
}

/**
 * Registry simples que consome dados da API
 * Não registra módulos, apenas armazena dados recebidos
 */
class ModuleRegistry {
  private static instance: ModuleRegistry;
  private modules: ModuleData[] = [];
  private isLoaded: boolean = false;

  private constructor() { }

  static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  /**
   * Carrega módulos da API
   * Deve ser chamado após autenticação
   */
  async loadModules(): Promise<void> {
    try {
      // console.log('🔄 [ModuleRegistry] Iniciando carregamento de módulos...');

      // URL completa para garantir que vai para o backend
      const response = await api.get<ModulesResponse>(`${API_URL}/me/modules`);

      // console.log('📡 [ModuleRegistry] Resposta da API:', response.data);

      // Filtra apenas módulos habilitados para o tenant
      // O backend retorna todos os módulos do sistema com flag enabled
      this.modules = response.data.modules.filter(m => m.enabled !== false);

      this.isLoaded = true;

      // console.log('✅ [ModuleRegistry] Módulos carregados da API:', {
      //   total: this.modules.length,
      //   modulos: this.modules.map(m => ({
      //     slug: m.slug,
      //     name: m.name,
      //     menus: m.menus ? m.menus.length : 0
      //   }))
      // });

    } catch (error) {
      console.error('❌ [ModuleRegistry] Erro ao carregar módulos:', error);
      this.modules = [];
      this.isLoaded = false;
    }
  }

  /**
   * Obtém todos os menus dos módulos ativos
   */
  getAllMenus(): ModuleMenu[] {
    if (!this.isLoaded) {
      console.warn('⚠️ Módulos ainda não carregados, chame loadModules() primeiro');
      return [];
    }

    const allMenus: ModuleMenu[] = [];

    for (const module of this.modules) {
      allMenus.push(...module.menus);
    }

    return allMenus;
  }

  /**
   * Obtém menus de um módulo específico
   */
  getModuleMenus(slug: string): ModuleMenu[] {
    const module = this.modules.find(m => m.slug === slug);
    return module ? module.menus : [];
  }

  /**
   * Verifica se um módulo está disponível
   */
  hasModule(slug: string): boolean {
    return this.modules.some(m => m.slug === slug);
  }

  /**
   * Lista todos os módulos disponíveis
   */
  getAvailableModules(): string[] {
    return this.modules.map(m => m.slug);
  }

  /**
   * Força reload dos módulos
   */
  async reload(): Promise<void> {
    this.isLoaded = false;
    await this.loadModules();
  }

  /**
   * Debug: mostra estado atual
   */
  debug(): void {
    console.log('📦 Module Registry Status:');
    console.log('  - Loaded:', this.isLoaded);
    console.log('  - Modules:', this.modules.length);
    this.modules.forEach(module => {
      console.log(`    - ${module.slug}: ${module.menus.length} menus`);
    });
  }

  /**
   * Obtém itens da sidebar agrupados (para compatibilidade com Sidebar antiga)
   * Retorna menu básico do core + menus dos módulos
   */
  getGroupedSidebarItems(userRole?: string): {
    ungrouped: any[];
    groups: Record<string, any[]>;
    groupOrder: string[];
  } {
    // Menu básico do CORE (sempre presente)
    const coreItems = [
      {
        id: 'dashboard',
        name: 'Dashboard',
        href: '/dashboard',
        icon: 'LayoutDashboard',
        order: 1
      }
    ];

    // Adiciona itens de administração se for ADMIN ou SUPER_ADMIN
    const adminItems = [];
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      adminItems.push(
        {
          id: 'tenants',
          name: 'Empresas',
          href: '/empresas',
          icon: 'Building2',
          order: 10,
          group: 'administration'
        },
        {
          id: 'users',
          name: 'Usuários',
          href: '/usuarios',
          icon: 'Users',
          order: 11,
          group: 'administration'
        },
        {
          id: 'configuracoes',
          name: 'Configurações',
          href: '/configuracoes',
          icon: 'Settings',
          order: 12,
          group: 'administration'
        }
      );
    }

    // Separa itens não agrupados e agrupados
    const ungrouped = coreItems;
    const groups: Record<string, any[]> = {};
    const groupOrder: string[] = [];

    // Processa itens de administração
    if (adminItems.length > 0) {
      groups['administration'] = adminItems;
      groupOrder.push('administration');
    }

    // Se não houver módulos carregados, retorna apenas menu do core
    if (!this.isLoaded || this.modules.length === 0) {
      // console.log('⚠️ [ModuleRegistry] Nenhum módulo carregado, retornando apenas core');
      return {
        ungrouped,
        groups,
        groupOrder
      };
    }

    // console.log('🔍 [ModuleRegistry] Processando menus dos módulos:', this.modules.length);

    // Processar menus dos módulos
    for (const module of this.modules) {
      if (!module.menus || module.menus.length === 0) {
        // console.log(`  ⚠️ Módulo ${module.slug} sem menus`);
        continue;
      }

      // console.log(`  📝 Módulo ${module.slug}: ${module.menus.length} menus`);

      // Cada módulo cria seu próprio grupo
      const moduleSlug = module.slug;
      const moduleItems: any[] = [];

      for (const menu of module.menus) {
        // console.log(`     - Menu: ${menu.label}, children: ${menu.children ? menu.children.length : 0}`);

        // Se o menu tem filhos, adiciona cada filho
        if (menu.children && menu.children.length > 0) {
          for (const child of menu.children) {
            moduleItems.push({
              id: child.id,
              name: child.label,
              href: child.route,
              icon: child.icon || 'Menu',
              order: child.order,
              group: moduleSlug
            });
          }
        } else {
          // Menu sem filhos
          moduleItems.push({
            id: menu.id,
            name: menu.label,
            href: menu.route,
            icon: menu.icon || 'Menu',
            order: menu.order,
            group: moduleSlug
          });
        }
      }

      if (moduleItems.length > 0) {
        // console.log(`  ✅ Adicionado grupo '${moduleSlug}' com ${moduleItems.length} itens`);
        groups[moduleSlug] = moduleItems;
        groupOrder.push(moduleSlug);
      }
    }

    // console.log('✅ [ModuleRegistry] Grupos finais:', Object.keys(groups));

    return {
      ungrouped,
      groups,
      groupOrder
    };
  }

  /**
   * Obtém itens da sidebar simplificados (para Sidebar nova)
   */
  getSidebarItems(userRole?: string, permissions?: string[]): any[] {
    const grouped = this.getGroupedSidebarItems(userRole);
    return grouped.ungrouped;
  }

  /**
   * Obtém widgets do dashboard (para compatibilidade)
   */
  getDashboardWidgets(): any[] {
    // Se não houver módulos, retorna array vazio
    if (!this.isLoaded || this.modules.length === 0) {
      return [];
    }

    // console.log('📊 [ModuleRegistry] Gerando widgets do dashboard para módulos:', this.modules.length);

    // Gerar widgets para módulos ativos
    const widgets: any[] = [];

    for (const module of this.modules) {
      // Criar widget padrão para cada módulo
      widgets.push({
        id: `${module.slug}-widget`,
        title: module.name,
        component: 'GenericModuleWidget', // Usar widget genérico
        module: module.slug,
        icon: 'Package', // Ícone padrão, pode ser customizado
        size: 'small',
        order: 100,
        permissions: []
      });

      // console.log(`  ✅ Widget criado para módulo: ${module.slug}`);
    }

    // console.log(`📊 [ModuleRegistry] Total de widgets: ${widgets.length}`);
    return widgets;
  }

  /**
   * Obtém notificações (para compatibilidade)
   */
  getNotifications(): any[] {
    // Se não houver módulos, retorna array vazio
    if (!this.isLoaded || this.modules.length === 0) {
      return [];
    }

    // TODO: Implementar quando API retornar notificações
    return [];
  }

  /**
   * Obtém itens da taskbar (para compatibilidade)
   */
  getTaskbarItems(userRole?: string): any[] {
    // Se não houver módulos, retorna array vazio
    if (!this.isLoaded || this.modules.length === 0) {
      // console.log('⚠️ [ModuleRegistry] Nenhum módulo carregado para taskbar');
      return [];
    }

    // console.log('🔧 [ModuleRegistry] Gerando itens da taskbar para módulos:', this.modules.length);

    // Gerar itens da taskbar para módulos ativos
    const taskbarItems: any[] = [];

    for (const module of this.modules) {
      // Criar item de taskbar para cada módulo
      taskbarItems.push({
        id: `${module.slug}-taskbar`,
        name: module.name,
        icon: 'Package', // Ícone padrão, pode ser customizado
        href: `/modules/${module.slug}/dashboard`, // Rota padrão
        order: 100
      });

      // console.log(`  ✅ Item de taskbar criado para módulo: ${module.slug}`);
    }

    // console.log(`🔧 [ModuleRegistry] Total de itens na taskbar: ${taskbarItems.length}`);
    return taskbarItems;
  }

  /**
   * Obtém itens do menu do usuário (para compatibilidade)
   */
  getUserMenuItems(userRole?: string): ModuleUserMenuItem[] {
    // Se não houver módulos, retorna array vazio
    if (!this.isLoaded || this.modules.length === 0) {
      // console.log('⚠️ [ModuleRegistry] Nenhum módulo carregado para menu do usuário');
      return [];
    }

    // console.log('👤 [ModuleRegistry] Gerando itens do menu do usuário para módulos:', this.modules.length);

    // Gerar itens do menu do usuário para módulos ativos
    const userMenuItems: ModuleUserMenuItem[] = [];

    for (const module of this.modules) {
      // Criar item de menu do usuário para cada módulo
      userMenuItems.push({
        id: `${module.slug}-user-menu`,
        label: `Acessar ${module.name}`,
        icon: 'ExternalLink',
        href: `/modules/${module.slug}/dashboard`,
        order: 100
      });

      // console.log(`  ✅ Item de menu do usuário criado para módulo: ${module.slug}`);
    }

    // console.log(`👤 [ModuleRegistry] Total de itens no menu do usuário: ${userMenuItems.length}`);
    return userMenuItems;
  }
}

// Exporta instância singleton
export const moduleRegistry = ModuleRegistry.getInstance();