/**
 * CoreContext - Contexto global injetado em todos os módulos
 * Objeto imutável que contém tudo que um módulo precisa para operar
 */

import { Tenant, User, ResponseInstance, RequestInstance, Environment } from '../contracts/types';
import { EventBus } from '../events/EventBus';

/**
 * Interface do Database Connection (será implementado depois)
 */
export interface DatabaseConnection {
  connection: unknown;
  transaction<T>(callback: (trx: unknown) => Promise<T>): Promise<T>;
  runModuleMigrations(moduleSlug: string): Promise<void>;
  raw(sql: string, params?: Record<string, unknown>[]): Promise<unknown>;
}

/**
 * Interface do Cache Manager (será implementado depois)
 */
export interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Interface do Logger (será implementado depois)
 */
export interface Logger {
  info(message: string, meta?: unknown): void;
  error(message: string, error?: Error, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
}

/**
 * Interface do Router Manager (será implementado depois)
 */
export interface RouterManager {
  register(path: string, handler: unknown): void;
  getRoutes(): unknown[];
}

/**
 * Interface do Notification Manager (será implementado depois)
 */
export interface NotificationManager {
  registerChannel(name: string, handler: unknown): void;
  send(channel: string, message: any, targets: unknown[]): Promise<void>;
  broadcast(message: unknown): Promise<void>;
}

/**
 * Interface do Menu Manager (será implementado depois)
 */
export interface MenuManager {
  add(item: unknown): void;
  remove(id: string): void;
  getItems(user: User | null): unknown[];
  clear(): void;
}

/**
 * Interface do Dashboard Manager (será implementado depois)
 */
export interface DashboardManager {
  addWidget(widget: unknown): void;
  removeWidget(id: string): void;
  getWidgets(user: User | null): unknown[];
  clear(): void;
}

/**
 * Interface do ACL Manager (será implementado depois)
 */
export interface ACLManager {
  registerRole(name: string, permissions: string[]): void;
  registerPermission(name: string, description: string): void;
  userHasPermission(user: User | null, permission: string): boolean;
  userHasRole(user: User | null, role: string): boolean;
  filterByPermission<T extends { permissions?: string[] }>(items: T[], user: User | null): T[];
}

/**
 * CoreContext - Contexto imutável global
 */
export interface CoreContext {
  // ==================== IDENTIFICAÇÃO ====================

  /** Tenant atual (empresa/organização) */
  readonly tenant: Tenant | null;

  /** Usuário autenticado */
  readonly user: User | null;

  /** Permissões do usuário */
  readonly permissions: string[];

  // ==================== HTTP (em requisições) ====================

  /** Requisição HTTP (opcional, apenas em contexto de requisição) */
  readonly request?: RequestInstance;

  /** Resposta HTTP (opcional, apenas em contexto de requisição) */
  readonly response?: ResponseInstance;

  // ==================== INFRAESTRUTURA ====================

  /** Conexão com banco de dados */
  readonly db: DatabaseConnection;

  /** Gerenciador de cache */
  readonly cache: CacheManager;

  /** Sistema de logging */
  readonly logger: Logger;

  // ==================== MANAGERS ====================

  /** Event Bus para comunicação */
  readonly events: EventBus;

  /** Gerenciador de rotas */
  readonly router: RouterManager;

  /** Gerenciador de notificações */
  readonly notifier: NotificationManager;

  /** Gerenciador de menus */
  readonly menu: MenuManager;

  /** Gerenciador de dashboard */
  readonly dashboard: DashboardManager;

  /** Gerenciador de ACL (permissões) */
  readonly acl: ACLManager;

  // ==================== METADADOS ====================

  /** ID único da requisição */
  readonly requestId: string;

  /** Timestamp de criação do contexto */
  readonly timestamp: Date;

  /** Ambiente de execução */
  readonly environment: Environment;
}
