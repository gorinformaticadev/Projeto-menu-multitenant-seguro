/**
 * Tipos compartilhados do CORE
 * Tipos básicos utilizados por toda a plataforma
 */

/**
 * Request genérico (abstração)
 */
export type RequestInstance = unknown;

/**
 * Response genérico (abstração)
 */
export type ResponseInstance = unknown;

/**
 * Papel/Role no sistema
 */
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
  CLIENT = 'CLIENT'
}

/**
 * Ambiente de execução
 */
export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test'
}

/**
 * Entidade Tenant (empresa/organização)
 */
export interface Tenant {
  id: string;
  email: string;
  cnpjCpf: string;
  nomeFantasia: string;
  nomeResponsavel: string;
  telefone: string;
  logoUrl?: string;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Usuário do sistema
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId?: string;
  tenant?: Tenant;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Permissão no sistema
 */
export interface Permission {
  id: string;
  name: string;
  description: string;
  module?: string;
}

/**
 * Contexto de requisição HTTP
 */
export interface RequestContext {
  request: RequestInstance;
  response: ResponseInstance;
  requestId: string;
  timestamp: Date;
  tenant: Tenant | null;
  user: User | null;
  permissions: string[];
}

/**
 * Resultado de operação genérico
 */
export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Metadados de paginação
 */
export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Resultado paginado
 */
export interface PaginatedResult<T> {
  data: T[];
  metadata: PaginationMetadata;
}
