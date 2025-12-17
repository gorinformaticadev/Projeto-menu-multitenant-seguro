/**
 * Tipos de eventos do sistema
 * Define todos os eventos que o CORE pode disparar
 */

import { Tenant, User } from '../contracts/types';

/**
 * Router genérico (abstração para evitar dependência direta do Express)
 */
export type RouterInstance = any;

/**
 * Payload do evento core:boot
 */
export interface CoreBootEvent {
  timestamp: Date;
  environment: string;
}

/**
 * Payload do evento core:ready
 */
export interface CoreReadyEvent {
  modules: string[];
  timestamp: Date;
}

/**
 * Payload do evento core:shutdown
 */
export interface CoreShutdownEvent {
  reason: string;
  timestamp: Date;
}

/**
 * Payload do evento menu:register
 */
export interface MenuRegisterEvent {
  timestamp: Date;
}

/**
 * Payload do evento dashboard:register
 */
export interface DashboardRegisterEvent {
  timestamp: Date;
}

/**
 * Payload do evento routes:register
 */
export interface RoutesRegisterEvent {
  router: RouterInstance;
  timestamp: Date;
}

/**
 * Payload do evento permissions:register
 */
export interface PermissionsRegisterEvent {
  timestamp: Date;
}

/**
 * Payload do evento notifications:register
 */
export interface NotificationsRegisterEvent {
  timestamp: Date;
}

/**
 * Payload do evento tenant:resolved
 */
export interface TenantResolvedEvent {
  tenant: Tenant | null;
  requestId: string;
  timestamp: Date;
}

/**
 * Payload do evento user:authenticated
 */
export interface UserAuthenticatedEvent {
  user: User;
  requestId: string;
  timestamp: Date;
}

/**
 * Payload do evento module:discovered
 */
export interface ModuleDiscoveredEvent {
  slug: string;
  name: string;
  version: string;
  timestamp: Date;
}

/**
 * Payload do evento module:installed
 */
export interface ModuleInstalledEvent {
  slug: string;
  name: string;
  version: string;
  hasBackend: boolean;
  hasFrontend: boolean;
  timestamp: Date;
}

/**
 * Payload do evento module:activated
 */
export interface ModuleActivatedEvent {
  slug: string;
  name: string;
  timestamp: Date;
}

/**
 * Payload do evento module:deactivated
 */
export interface ModuleDeactivatedEvent {
  slug: string;
  name: string;
  timestamp: Date;
}

/**
 * Payload do evento module:migration:executed
 */
export interface ModuleMigrationExecutedEvent {
  moduleSlug: string;
  filename: string;
  type: 'migration' | 'seed';
  success: boolean;
  duration: number;
  timestamp: Date;
}

/**
 * Mapa de eventos do sistema
 * Garante type-safety nos eventos
 */
export interface EventMap {
  'core:boot': CoreBootEvent;
  'core:ready': CoreReadyEvent;
  'core:shutdown': CoreShutdownEvent;
  'menu:register': MenuRegisterEvent;
  'dashboard:register': DashboardRegisterEvent;
  'routes:register': RoutesRegisterEvent;
  'permissions:register': PermissionsRegisterEvent;
  'notifications:register': NotificationsRegisterEvent;
  'tenant:resolved': TenantResolvedEvent;
  'user:authenticated': UserAuthenticatedEvent;
  'module:discovered': ModuleDiscoveredEvent;
  'module:installed': ModuleInstalledEvent;
  'module:activated': ModuleActivatedEvent;
  'module:deactivated': ModuleDeactivatedEvent;
  'module:migration:executed': ModuleMigrationExecutedEvent;
}

/**
 * Nomes de eventos disponíveis
 */
export type EventName = keyof EventMap;

/**
 * Listener de evento
 */
export type EventListener<T = any> = (payload: T) => void | Promise<void>;
