/**
 * MODULE REGISTRY CENTRALIZADO
 * Implementação determinística e estável do registro de módulos
 * 
 * REGRAS:
 * - Módulos apenas se registram, não tomam decisões
 * - Core agrega e filtra baseado em permissões/roles
 * - Nenhuma lógica mágica ou auto-discovery
 * - Comportamento previsível e determinístico
 */

import { 
  IModuleRegistry, 
  ModuleContribution, 
  ModuleMenuItem, 
  ModuleDashboardWidget, 
  ModuleTaskbarItem, 
  ModuleUserMenuItem, 
  ModuleNotification 
} from '../types/module.types';

class ModuleRegistry implements IModuleRegistry {
  private static instance: ModuleRegistry;
  private contributions: Map<string, ModuleContribution> = new Map();

  private // Empty constructor removed

  static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  /**
   * Registra um módulo no sistema
   * Módulo apenas declara o que oferece
   */
  register(contribution: ModuleContribution): void {
    if (!contribution.id || !contribution.name) {
      console.warn('Tentativa de registro de módulo inválido:', contribution);
      return;
    }

    this.contributions.set(contribution.id, contribution);
    }

  /**
   * Remove um módulo do registro
   */
  unregister(moduleId: string): void {
    if (this.contributions.has(moduleId)) {
      this.contributions.delete(moduleId);
      }
  }

  /**
   * Verifica se um módulo está registrado
   */
  isRegistered(moduleId: string): boolean {
    return this.contributions.has(moduleId);
  }

  /**
   * Retorna a contribuição de um módulo específico
   */
  getContribution(moduleId: string): ModuleContribution | undefined {
    return this.contributions.get(moduleId);
  }

  /**
   * Retorna todas as contribuições registradas
   */
  getAllContributions(): ModuleContribution[] {
    return Array.from(this.contributions.values());
  }

  /**
   * FUNÇÃO DE AGREGAÇÃO: Sidebar Items
   * Core verifica se módulo tem sidebar → se tiver carrega, se não ignora
   */
  getSidebarItems(userRole?: string, permissions?: string[]): ModuleMenuItem[] {
    const items: ModuleMenuItem[] = [];

    for (const contribution of this.contributions.values()) {
      // Se módulo não declarou sidebar → ignora silenciosamente
      if (!contribution.enabled || !contribution.sidebar) {
        continue;
      }

      // Filtra itens baseado em permissões/roles
      const filteredItems = contribution.sidebar.filter(item => 
        this.hasAccess(item.roles, item.permissions, userpermissions)
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
   * FUNÇÃO DE AGREGAÇÃO: Dashboard Widgets
   */
  getDashboardWidgets(userRole?: string, permissions?: string[]): ModuleDashboardWidget[] {
    const widgets: ModuleDashboardWidget[] = [];

    for (const contribution of this.contributions.values()) {
      // Se módulo não declarou dashboard → ignora silenciosamente
      if (!contribution.enabled || !contribution.dashboard) {
        continue;
      }

      const filteredWidgets = contribution.dashboard.filter(widget => 
        this.hasAccess(widget.roles, widget.permissions, userpermissions)
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
   * FUNÇÃO DE AGREGAÇÃO: Taskbar Items
   */
  getTaskbarItems(userRole?: string, permissions?: string[]): ModuleTaskbarItem[] {
    const items: ModuleTaskbarItem[] = [];

    for (const contribution of this.contributions.values()) {
      // Se módulo não declarou taskbar → ignora silenciosamente
      if (!contribution.enabled || !contribution.taskbar) {
        continue;
      }

      const filteredItems = contribution.taskbar.filter(item => 
        this.hasAccess(item.roles, item.permissions, userpermissions)
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
   * FUNÇÃO DE AGREGAÇÃO: User Menu Items
   */
  getUserMenuItems(userRole?: string, permissions?: string[]): ModuleUserMenuItem[] {
    const items: ModuleUserMenuItem[] = [];

    for (const contribution of this.contributions.values()) {
      // Se módulo não declarou userMenu → ignora silenciosamente
      if (!contribution.enabled || !contribution.userMenu) {
        continue;
      }

      const filteredItems = contribution.userMenu.filter(item => 
        this.hasAccess(item.roles, item.permissions, userpermissions)
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
      // Se módulo não declarou notifications → ignora silenciosamente
      if (!contribution.enabled || !contribution.notifications) {
        continue;
      }

      const filteredNotifications = contribution.notifications.filter(notification => 
        this.hasAccess(notification.roles, notification.permissions, userpermissions)
      );

      notifications.push(...filteredNotifications);
    }

    return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
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
}

// Exporta instância singleton
export const moduleRegistry = ModuleRegistry.getInstance();