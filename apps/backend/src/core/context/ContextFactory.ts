/**
 * ContextFactory - Fábrica para criar instâncias de CoreContext
 * Responsável por criar contextos imutáveis para módulos e requisições
 */

import {
  CoreContext,
  DatabaseConnection,
  CacheManager,
  Logger,
  RouterManager,
  NotificationManager,
  MenuManager,
  DashboardManager,
  ACLManager,
} from './CoreContext';
import { Tenant, User, ResponseInstance, RequestInstance, Environment } from '../contracts/types';
import { EventBus } from '../events/EventBus';

/**
 * Opções para criação de contexto
 */
export interface ContextOptions {
  // Identificação
  tenant?: Tenant | null;
  user?: User | null;
  permissions?: string[];

  // HTTP
  request?: RequestInstance;
  response?: ResponseInstance;

  // Infraestrutura
  db: DatabaseConnection;
  cache: CacheManager;
  logger: Logger;

  // Managers
  events: EventBus;
  router: RouterManager;
  notifier: NotificationManager;
  menu: MenuManager;
  dashboard: DashboardManager;
  acl: ACLManager;

  // Metadados
  requestId?: string;
  environment: Environment;
}

/**
 * Gera um ID único simples
 * Formato: timestamp-random
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Fábrica de contextos
 */
export class ContextFactory {
  /**
   * Cria um CoreContext imutável
   * @param options - Opções de criação do contexto
   * @returns CoreContext imutável
   */
  public static create(options: ContextOptions): CoreContext {
    // Gerar requestId se não fornecido
    const requestId = options.requestId || generateId();

    // Calcular permissões do usuário
    const permissions = options.permissions || options.user?.permissions || [];

    // Criar objeto de contexto
    const context: CoreContext = Object.freeze({
      // Identificação
      tenant: options.tenant ?? null,
      user: options.user ?? null,
      permissions,

      // HTTP (opcionais)
      request: options.request,
      response: options.response,

      // Infraestrutura
      db: options.db,
      cache: options.cache,
      logger: options.logger,

      // Managers
      events: options.events,
      router: options.router,
      notifier: options.notifier,
      menu: options.menu,
      dashboard: options.dashboard,
      acl: options.acl,

      // Metadados
      requestId,
      timestamp: new Date(),
      environment: options.environment,
    });

    return context;
  }

  /**
   * Cria um contexto de boot (sem request/response)
   * Usado durante inicialização do sistema
   */
  public static createBootContext(options: Omit<ContextOptions, 'request' | 'response'>): CoreContext {
    return this.create(options);
  }

  /**
   * Cria um contexto de requisição HTTP
   * Usado durante processamento de requisições
   */
  public static createRequestContext(
    baseOptions: Omit<ContextOptions, 'request' | 'response' | 'tenant' | 'user' | 'permissions'>,
    request: RequestInstance,
    response: ResponseInstance,
    tenant?: Tenant | null,
    user?: User | null
  ): CoreContext {
    return this.create({
      ...baseOptions,
      request,
      response,
      tenant,
      user,
      permissions: user?.permissions || [],
    });
  }

  /**
   * Clona um contexto existente com alterações
   * Útil para criar variações de contexto
   */
  public static clone(context: CoreContext, changes: Partial<CoreContext>): CoreContext {
    return Object.freeze({
      ...context,
      ...changes,
      timestamp: new Date(), // Novo timestamp
      requestId: changes.requestId || generateId(), // Novo requestId se não especificado
    });
  }
}
