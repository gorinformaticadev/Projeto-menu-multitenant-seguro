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
  label: string;
  icon?: string;
  route: string;
  children?: ModuleMenu[];
}

export interface ModuleData {
  slug: string;
  menus: ModuleMenu[];
}

export interface ModulesResponse {
  modules: ModuleData[];
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
      // URL completa para garantir que vai para o backend
      const response = await api.get<ModulesResponse>(`${API_URL}/me/modules`);
      this.modules = response.data.modules;
      this.isLoaded = true;

      console.log('✅ Módulos carregados da API:', this.modules.map(m => m.slug));

    } catch (error) {
      console.error('❌ Erro ao carregar módulos:', error);
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

    // Combina itens do core
    const ungrouped = [...coreItems, ...adminItems];

    // Se não houver módulos carregados, retorna apenas menu do core
    if (!this.isLoaded || this.modules.length === 0) {
      return {
        ungrouped,
        groups: {},
        groupOrder: []
      };
    }

    // TODO: Processar menus dos módulos quando API retornar dados
    // Por enquanto retorna apenas menus do core
    
    return {
      ungrouped,
      groups: {},
      groupOrder: []
    };
  }

  /**
   * Obtém widgets do dashboard (para compatibilidade)
   */
  getDashboardWidgets(): any[] {
    // Se não houver módulos, retorna array vazio
    if (!this.isLoaded || this.modules.length === 0) {
      return [];
    }

    // TODO: Implementar quando API retornar widgets
    return [];
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
      return [];
    }

    // TODO: Implementar quando API retornar taskbar items
    return [];
  }
}

// Exporta instância singleton
export const moduleRegistry = ModuleRegistry.getInstance();