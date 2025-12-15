/**
 * CORE - Plataforma Modular Ideal
 * Exportações principais do CORE
 */

// ==================== CONTRATOS E TIPOS ====================
export * from './contracts/types';
export * from './contracts/ModuleContract';
export * from './contracts/MenuItem';
export * from './contracts/DashboardWidget';
export * from './contracts/NotificationChannel';

// ==================== EVENTOS ====================
export * from './events/event-types';
export { EventBus, eventBus } from './events/EventBus';

// ==================== CONTEXTO ====================
export * from './context/CoreContext';
export { ContextFactory } from './context/ContextFactory';

// ==================== MÓDULOS ====================
export { ModuleRegistry, moduleRegistry } from './modules/ModuleRegistry';
export { ModuleValidator } from './modules/ModuleValidator';
export { DependencyResolver } from './modules/DependencyResolver';
export { ModuleLoader } from './modules/ModuleLoader';
export type { LoaderOptions, LoadResult } from './modules/ModuleLoader';
export type { ValidationResult } from './modules/ModuleValidator';

// ==================== MANAGERS ====================
export { MenuManager } from './ui/MenuManager';
export { DashboardManager } from './ui/DashboardManager';
export { NotificationManager } from './ui/NotificationManager';

// ==================== ACL ====================
export { ACLManager } from './acl/ACLManager';
export type { RoleDefinition } from './acl/ACLManager';

// ==================== BOOTSTRAP ====================
export { CoreBootstrap, bootstrap } from './bootstrap/CoreBootstrap';
export type { BootstrapOptions } from './bootstrap/CoreBootstrap';
