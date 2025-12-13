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

  private constructor() {
    // Por padrão, Module Exemplo está ativo
    this.moduleActivationStatus.set('module-exemplo', true);
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
    return contribution.enabled && this.isModuleActive(contribution.id);
  }

  /**
   * Debug: Lista todos os módulos registrados
   */
  debug(): void {
    console.log('📋 Módulos registrados:', Array.from(this.contributions.keys()));
    for (const [id, contribution] of this.contributions.entries()) {
      const isActive = this.isModuleActive(id);
      console.log(`  - ${id}: ${isActive ? '✅' : '❌'} ${contribution.sidebar?.length || 0} sidebar, ${contribution.dashboard?.length || 0} dashboard, ${contribution.userMenu?.length || 0} userMenu, ${contribution.notifications?.length || 0} notifications, ${contribution.taskbar?.length || 0} taskbar`);
    }
  }
}

// Exporta instância singleton
export const moduleRegistry = ModuleRegistry.getInstance();