/**
 * CONTRATOS EXPLÍCITOS PARA MÓDULOS
 * Define as interfaces que os módulos devem implementar
 */

export interface ModuleMenuItem {
  id: string;
  name: string;
  href: string;
  icon: string;
  order?: number;
  permissions?: string[];
  roles?: string[];
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

export interface ModuleTaskbarItem {
  id: string;
  name: string;
  icon: string;
  action: string;
  order?: number;
  permissions?: string[];
  roles?: string[];
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
  timestamp: Date;
  permissions?: string[];
  roles?: string[];
}

/**
 * CONTRATO PRINCIPAL DO MÓDULO
 * Define o que um módulo pode contribuir para o core
 */
export interface ModuleContribution {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  
  // Contribuições opcionais - se não declarar, core ignora silenciosamente
  sidebar?: ModuleMenuItem[];
  dashboard?: ModuleDashboardWidget[];
  taskbar?: ModuleTaskbarItem[];
  userMenu?: ModuleUserMenuItem[];
  notifications?: ModuleNotification[];
}

/**
 * INTERFACE DO MODULE REGISTRY
 * Define como o core gerencia os módulos
 */
export interface IModuleRegistry {
  register(contribution: ModuleContribution): void;
  unregister(moduleId: string): void;
  isRegistered(moduleId: string): boolean;
  getContribution(moduleId: string): ModuleContribution | undefined;
  getAllContributions(): ModuleContribution[];
  
  // Funções de agregação que o core usa
  getSidebarItems(userRole?: string, permissions?: string[]): ModuleMenuItem[];
  getDashboardWidgets(userRole?: string, permissions?: string[]): ModuleDashboardWidget[];
  getTaskbarItems(userRole?: string, permissions?: string[]): ModuleTaskbarItem[];
  getUserMenuItems(userRole?: string, permissions?: string[]): ModuleUserMenuItem[];
  getNotifications(userRole?: string, permissions?: string[]): ModuleNotification[];
}