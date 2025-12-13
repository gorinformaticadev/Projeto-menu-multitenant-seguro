/**
 * MODULE REGISTRY CENTRALIZADO - FRONTEND PRINCIPAL
 * Implementação determinística e estável do registro de módulos
 * 
 * REGRAS:
 * - Módulos apenas se registram, não tomam decisões
 * - Core agrega e filtra baseado em permissões/roles
 * - Nenhuma lógica mágica ou auto-discovery
 * - Comportamento previsível e determinístico
 */

export interface ModuleMenuItem {
  id: string;
  name: string;
  href: string;
  icon: string;
  order?: number;
  permissions?: string[];
  roles?: string[];
  group?: string; // Novo: permite agrupar itens
}

export interface ModuleDashboardWidget {
  id: string;
  name: string;
  component: string;
  order?: number;
  permissions?: string[];
  roles?: string[];
  size?: 'small' | 'medium' | 'large';
}

export interface ModuleUserMenuItem {
  id: string;
  name: string;
  href: string;
  icon: string;
  order?: number;
  permissions?: string[];
  roles?: string[];
}

export interface ModuleNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp?: Date;
  permissions?: string[];
  roles?: string[];
}

export interface ModuleTaskbarItem {
  id: string;
  name: string;
  href: string;
  icon: string;
  order?: number;
  permissions?: string[];
  roles?: string[];
}

export interface ModuleContribution {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  
  // Contribuições opcionais - se não declarar, core ignora silenciosamente
  sidebar?: ModuleMenuItem[];
  dashboard?: ModuleDashboardWidget[];
  userMenu?: ModuleUserMenuItem[];
  notifications?: ModuleNotification[];
  taskbar?: ModuleTaskbarItem[];
}

class ModuleRegistry {
  private static instance: ModuleRegistry;
  private contributions: Map<string, ModuleContribution> = new Map();
  private moduleActivationStatus: Map<string, boolean> = new Map();
  private isInitialized: boolean = false;

  private constructor() {
    // Estado inicial será carregado do backend
  }

  static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  /**
   * Registra um módulo no sistema
   */
  register(contribution: ModuleContribution): void {
    if (!contribution.id || !contribution.name) {
      console.warn('Tentativa de registro de módulo inválido:', contribution);
      return;
    }

    this.contributions.set(contribution.id, contribution);
    console.log(`✅ Módulo registrado: ${contribution.id} v${contribution.version}`);
  }

  /**
   * Remove um módulo do registro
   */
  unregister(moduleId: string): void {
    if (this.contributions.has(moduleId)) {
      this.contributions.delete(moduleId);
      console.log(`❌ Módulo removido: ${moduleId}`);
    }
  }

  /**
   * FUNÇÃO DE AGREGAÇÃO: Sidebar Items
   * Core verifica se módulo tem sidebar → se tiver carrega, se não ignora
   */
  getSidebarItems(userRole?: string, permissions?: string[]): ModuleMenuItem[] {
    const items: ModuleMenuItem[] = [];

    for (const contribution of this.contributions.values()) {
      // Se módulo não declarou sidebar ou não está ativo → ignora silenciosamente
      if (!this.isContributionActive(contribution) || !contribution.sidebar) {
        continue;
      }

      // Filtra itens baseado em permissões/roles
      const filteredItems = contribution.sidebar.filter(item => 
        this.hasAccess(item.roles, item.permissions, userRole, permissions)
      );

      items.push(...filteredItems);
    }

    // Ordena por order (se definido) ou por nome
    return items.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * FUNÇÃO DE AGREGAÇÃO: Sidebar Items Agrupados
   * Retorna itens organizados por grupos com ordenação correta
   */
  getGroupedSidebarItems(userRole?: string, permissions?: string[]): {
    ungrouped: ModuleMenuItem[];
    groups: Record<string, ModuleMenuItem[]>;
    groupOrder: string[];
  } {
    const allItems = this.getSidebarItems(userRole, permissions);
    const ungrouped: ModuleMenuItem[] = [];
    const groups: Record<string, ModuleMenuItem[]> = {};
    const groupOrderMap: Record<string, number> = {};

    for (const item of allItems) {
      if (item.group) {
        if (!groups[item.group]) {
          groups[item.group] = [];
          // Usa a ordem do primeiro item do grupo para determinar ordem do grupo
          groupOrderMap[item.group] = item.order || 999;
        }
        groups[item.group].push(item);
      } else {
        ungrouped.push(item);
      }
    }

    // Ordena grupos por ordem
    const groupOrder = Object.keys(groups).sort((a, b) => {
      return (groupOrderMap[a] || 999) - (groupOrderMap[b] || 999);
    });

    return { ungrouped, groups, groupOrder };
  }

  /**
   * FUNÇÃO DE AGREGAÇÃO: Dashboard Widgets
   */
  getDashboardWidgets(userRole?: string, permissions?: string[]): ModuleDashboardWidget[] {
    const widgets: ModuleDashboardWidget[] = [];

    for (const contribution of this.contributions.values()) {
      // Se módulo não declarou dashboard ou não está ativo → ignora silenciosamente
      if (!this.isContributionActive(contribution) || !contribution.dashboard) {
        continue;
      }

      const filteredWidgets = contribution.dashboard.filter(widget => 
        this.hasAccess(widget.roles, widget.permissions, userRole, permissions)
      );

      widgets.push(...filteredWidgets);
    }

    return widgets.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Verifica se o usuário tem acesso baseado em roles e permissões
   */
  private hasAccess(
    itemRoles?: string[], 
    itemPermissions?: string[], 
    userRole?: string, 
    userPermissions?: string[]
  ): boolean {
    // Se item não especifica restrições → acesso liberado
    if (!itemRoles && !itemPermissions) {
      return true;
    }

    // Verifica roles
    if (itemRoles && userRole) {
      if (itemRoles.includes(userRole)) {
        return true;
      }
    }

    // Verifica permissões
    if (itemPermissions && userPermissions) {
      const hasPermission = itemPermissions.some(permission => 
        userPermissions.includes(permission)
      );
      if (hasPermission) {
        return true;
      }
    }

    return false;
  }

  /**
   * FUNÇÃO DE AGREGAÇÃO: User Menu Items
   */
  getUserMenuItems(userRole?: string, permissions?: string[]): ModuleUserMenuItem[] {
    const items: ModuleUserMenuItem[] = [];

    for (const contribution of this.contributions.values()) {
      if (!this.isContributionActive(contribution) || !contribution.userMenu) {
        continue;
      }

      const filteredItems = contribution.userMenu.filter(item => 
        this.hasAccess(item.roles, item.permissions, userRole, permissions)
      );

      items.push(...filteredItems);
    }

    return items.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * FUNÇÃO DE AGREGAÇÃO: Notifications
   */
  getNotifications(userRole?: string, permissions?: string[]): ModuleNotification[] {
    const notifications: ModuleNotification[] = [];

    for (const contribution of this.contributions.values()) {
      if (!this.isContributionActive(contribution) || !contribution.notifications) {
        continue;
      }

      const filteredNotifications = contribution.notifications.filter(notification => 
        this.hasAccess(notification.roles, notification.permissions, userRole, permissions)
      );

      notifications.push(...filteredNotifications);
    }

    return notifications.sort((a, b) => {
      const aTime = a.timestamp?.getTime() || 0;
      const bTime = b.timestamp?.getTime() || 0;
      return bTime - aTime; // Mais recentes primeiro
    });
  }

  /**
   * FUNÇÃO DE AGREGAÇÃO: Taskbar Items
   */
  getTaskbarItems(userRole?: string, permissions?: string[]): ModuleTaskbarItem[] {
    const items: ModuleTaskbarItem[] = [];

    for (const contribution of this.contributions.values()) {
      if (!this.isContributionActive(contribution) || !contribution.taskbar) {
        continue;
      }

      const filteredItems = contribution.taskbar.filter(item => 
        this.hasAccess(item.roles, item.permissions, userRole, permissions)
      );

      items.push(...filteredItems);
    }

    return items.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Ativa um módulo
   */
  activateModule(moduleId: string): void {
    this.moduleActivationStatus.set(moduleId, true);
    console.log(`✅ Módulo ativado: ${moduleId}`);
  }

  /**
   * Desativa um módulo
   */
  deactivateModule(moduleId: string): void {
    this.moduleActivationStatus.set(moduleId, false);
    console.log(`❌ Módulo desativado: ${moduleId}`);
  }

  /**
   * Verifica se um módulo está ativo
   */
  isModuleActive(moduleId: string): boolean {
    return this.moduleActivationStatus.get(moduleId) ?? false;
  }

  /**
   * Verifica se uma contribuição deve ser considerada (módulo ativo)
   */
  private isContributionActive(contribution: ModuleContribution): boolean {
    // Core sempre está ativo
    if (contribution.id === 'core') {
      return contribution.enabled;
    }
    
    // Outros módulos dependem do status de ativação
    return contribution.enabled && this.isModuleActive(contribution.id);
  }

  // Cache para evitar múltiplas chamadas
  private initializationPromise: Promise<void> | null = null;
  private lastInitialization: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 segundos

  /**
   * Inicializa o registry carregando estado dos módulos do backend
   */
  async initializeFromBackend(): Promise<void> {
    // Se já está inicializado e o cache ainda é válido, retorna
    const now = Date.now();
    if (this.isInitialized && (now - this.lastInitialization) < this.CACHE_DURATION) {
      return;
    }

    // Se já há uma inicialização em andamento, aguarda ela
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Cria nova promise de inicialização
    this.initializationPromise = this.performInitialization();
    
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async performInitialization(): Promise<void> {
    try {
      // Importa o serviço dinamicamente para evitar dependência circular
      const { modulesService } = await import('@/services/modules.service');
      
      const response = await modulesService.getMyTenantActiveModules();
      
      // Limpa estado anterior
      this.moduleActivationStatus.clear();
      
      // Define status dos módulos baseado na resposta do backend
      response.modules.forEach(module => {
        this.moduleActivationStatus.set(module.name, module.isActive);
        console.log(`${module.isActive ? '✅' : '❌'} Módulo ${module.name} carregado como ${module.isActive ? 'ativo' : 'inativo'} do backend`);
      });
      
      this.isInitialized = true;
      this.lastInitialization = Date.now();
      console.log('🔄 Module Registry sincronizado com backend');
      console.log('📋 Módulos disponíveis:', response.modules.map(m => m.name));
      console.log('✅ Módulos ativos:', response.activeModules);
      
    } catch (error) {
      console.error('❌ Erro ao sincronizar com backend, usando estado padrão:', error);
      // Em caso de erro, usa estado padrão (module-exemplo ativo)
      this.moduleActivationStatus.set('module-exemplo', true);
      this.isInitialized = true;
      this.lastInitialization = Date.now();
    }
  }

  /**
   * Sincroniza ativação de módulo com o backend
   */
  async syncActivateModule(moduleId: string, tenantId?: string): Promise<void> {
    try {
      const { modulesService } = await import('@/services/modules.service');
      
      if (tenantId) {
        // Para SUPER_ADMIN gerenciando outros tenants
        await modulesService.activateModuleForTenant(tenantId, moduleId);
      } else {
        // Para usuário gerenciando seu próprio tenant
        // Como não há endpoint específico para o próprio tenant, 
        // vamos usar o endpoint do SUPER_ADMIN com o tenantId do usuário
        throw new Error('Ativação para próprio tenant não implementada ainda');
      }
      
      this.moduleActivationStatus.set(moduleId, true);
      console.log(`✅ Módulo ${moduleId} ativado e sincronizado com backend`);
      
    } catch (error) {
      console.error(`❌ Erro ao sincronizar ativação do módulo ${moduleId}:`, error);
      throw error;
    }
  }

  /**
   * Sincroniza desativação de módulo com o backend
   */
  async syncDeactivateModule(moduleId: string, tenantId?: string): Promise<void> {
    try {
      const { modulesService } = await import('@/services/modules.service');
      
      if (tenantId) {
        // Para SUPER_ADMIN gerenciando outros tenants
        await modulesService.deactivateModuleForTenant(tenantId, moduleId);
      } else {
        // Para usuário gerenciando seu próprio tenant
        throw new Error('Desativação para próprio tenant não implementada ainda');
      }
      
      this.moduleActivationStatus.set(moduleId, false);
      console.log(`❌ Módulo ${moduleId} desativado e sincronizado com backend`);
      
    } catch (error) {
      console.error(`❌ Erro ao sincronizar desativação do módulo ${moduleId}:`, error);
      throw error;
    }
  }

  /**
   * Debug: Lista todos os módulos registrados
   */
  debug(): void {
    console.log('📋 Módulos registrados:', Array.from(this.contributions.keys()));
    console.log('🔄 Registry inicializado:', this.isInitialized);
    for (const [id, contribution] of this.contributions.entries()) {
      const isActive = this.isModuleActive(id);
      console.log(`  - ${id}: ${isActive ? '✅' : '❌'} ${contribution.sidebar?.length || 0} sidebar, ${contribution.dashboard?.length || 0} dashboard, ${contribution.userMenu?.length || 0} userMenu, ${contribution.notifications?.length || 0} notifications, ${contribution.taskbar?.length || 0} taskbar`);
    }
  }
}

// Exporta instância singleton
export const moduleRegistry = ModuleRegistry.getInstance();