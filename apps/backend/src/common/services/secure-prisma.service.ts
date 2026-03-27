import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';

type PrismaModelDelegateKey = {
  [K in keyof PrismaService]: PrismaService[K] extends { findMany: (...args: never[]) => Promise<unknown> } ? K : never;
}[keyof PrismaService] & string;

type SecurePrismaWhere = Record<string, unknown>;
type SecurePrismaData = Record<string, unknown>;

interface SecurePrismaQueryOptions {
  select?: unknown;
  include?: unknown;
  orderBy?: unknown;
  skip?: number;
  take?: number;
}

interface SecurePrismaRecord extends Record<string, unknown> {
  id?: string | number;
  tenantId?: string | null;
}

interface SecureUsageStats {
  timestamp: string;
}

interface SecurePrismaDelegate<TRecord extends SecurePrismaRecord> {
  findMany(args: {
    where: SecurePrismaWhere;
    select?: unknown;
    include?: unknown;
    orderBy?: unknown;
    skip?: number;
    take?: number;
  }): Promise<TRecord[]>;
  findUnique(args: {
    where: SecurePrismaWhere;
    select?: unknown;
    include?: unknown;
  }): Promise<TRecord | null>;
  create(args: { data: SecurePrismaData }): Promise<TRecord>;
  update(args: {
    where: SecurePrismaWhere;
    data: SecurePrismaData;
  }): Promise<TRecord>;
  delete(args: { where: SecurePrismaWhere }): Promise<TRecord>;
}

@Injectable()
export class SecurePrismaService {
  private readonly logger = new Logger(SecurePrismaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Secure wrapper for findMany with automatic tenant isolation.
   */
  async findManySecure<T extends SecurePrismaRecord>(
    model: PrismaModelDelegateKey,
    where: SecurePrismaWhere,
    tenantId: string,
    userRole: string,
    options: SecurePrismaQueryOptions = {},
  ): Promise<T[]> {
    try {
      const tenantWhere =
        userRole !== 'SUPER_ADMIN'
          ? {
              ...where,
              tenantId,
            }
          : where;

      this.logger.debug(`Busca segura em ${String(model)} para tenant ${tenantId}`, {
        userRole,
        whereKeys: Object.keys(where),
        hasTenantFilter: userRole !== 'SUPER_ADMIN',
      });

      const delegate = this.getModelDelegate<T>(model);
      return await delegate.findMany({
        where: tenantWhere,
        select: options.select,
        include: options.include,
        orderBy: options.orderBy,
        skip: options.skip,
        take: options.take,
      });
    } catch (error) {
      this.logger.error(`Erro na busca segura em ${String(model)}:`, error);
      throw error;
    }
  }

  /**
   * Secure wrapper for findUnique with ownership validation.
   */
  async findUniqueSecure<T extends SecurePrismaRecord>(
    model: PrismaModelDelegateKey,
    where: SecurePrismaWhere,
    tenantId: string,
    userRole: string,
    options: Pick<SecurePrismaQueryOptions, 'select' | 'include'> = {},
  ): Promise<T | null> {
    try {
      const delegate = this.getModelDelegate<T>(model);
      const result = await delegate.findUnique({
        where,
        select: options.select,
        include: options.include,
      });

      if (!result) {
        return null;
      }

      if (userRole === 'SUPER_ADMIN') {
        this.logger.debug(`SUPER_ADMIN acessando recurso em ${String(model)}`, {
          resourceId: this.readRecordId(where),
          tenantId,
        });
        return result;
      }

      const resourceTenantId = this.readTenantId(result);
      if (resourceTenantId !== tenantId) {
        this.logger.warn('Tentativa de acesso cross-tenant bloqueada', {
          model: String(model),
          resourceId: this.readRecordId(where),
          userTenant: tenantId,
          resourceTenant: resourceTenantId,
          userRole,
        });
        return null;
      }

      return result;
    } catch (error) {
      this.logger.error(`Erro na busca unica segura em ${String(model)}:`, error);
      throw error;
    }
  }

  /**
   * Secure wrapper for create with tenant enforcement.
   */
  async createSecure<T extends SecurePrismaRecord>(
    model: PrismaModelDelegateKey,
    data: SecurePrismaData,
    tenantId: string,
    userId: string,
    userRole: string,
  ): Promise<T> {
    try {
      const requestedTenantId = this.readTenantId(data);
      const secureData: SecurePrismaData = {
        ...data,
        tenantId: userRole !== 'SUPER_ADMIN' ? tenantId : requestedTenantId || tenantId,
        createdBy: userId,
      };

      this.logger.debug(`Criacao segura em ${String(model)}`, {
        model: String(model),
        tenantId,
        userId,
        hasExplicitTenant: Boolean(requestedTenantId),
      });

      const delegate = this.getModelDelegate<T>(model);
      const result = await delegate.create({
        data: secureData,
      });

      this.logger.log(`Recurso criado: ${String(model)}`, {
        id: this.readRecordId(result),
        tenantId: this.readTenantId(result),
        createdBy: userId,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.logger.error(`Erro na criacao segura em ${String(model)}:`, error);
      throw error;
    }
  }

  /**
   * Secure wrapper for update with ownership validation.
   */
  async updateSecure<T extends SecurePrismaRecord>(
    model: PrismaModelDelegateKey,
    where: SecurePrismaWhere,
    data: SecurePrismaData,
    tenantId: string,
    userId: string,
    userRole: string,
  ): Promise<T> {
    try {
      const existing = await this.findUniqueSecure<T>(model, where, tenantId, userRole);
      if (!existing) {
        throw new Error('Recurso nao encontrado ou acesso nao autorizado');
      }

      this.logger.debug(`Atualizacao segura em ${String(model)}`, {
        resourceId: this.readRecordId(where),
        tenantId,
        userId,
      });

      const delegate = this.getModelDelegate<T>(model);
      const result = await delegate.update({
        where,
        data: {
          ...data,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Recurso atualizado: ${String(model)}`, {
        id: this.readRecordId(where),
        tenantId: this.readTenantId(result),
        updatedBy: userId,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.logger.error(`Erro na atualizacao segura em ${String(model)}:`, error);
      throw error;
    }
  }

  /**
   * Secure wrapper for delete with ownership validation.
   */
  async deleteSecure<T extends SecurePrismaRecord>(
    model: PrismaModelDelegateKey,
    where: SecurePrismaWhere,
    tenantId: string,
    userId: string,
    userRole: string,
  ): Promise<T> {
    try {
      const existing = await this.findUniqueSecure<T>(model, where, tenantId, userRole);
      if (!existing) {
        throw new Error('Recurso nao encontrado ou acesso nao autorizado');
      }

      this.logger.warn(`Exclusao segura em ${String(model)}`, {
        resourceId: this.readRecordId(where),
        tenantId,
        userId,
        userRole,
      });

      const delegate = this.getModelDelegate<T>(model);
      const result = await delegate.delete({
        where,
      });

      this.logger.log(`Recurso excluido: ${String(model)}`, {
        id: this.readRecordId(where),
        tenantId: this.readTenantId(result),
        deletedBy: userId,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.logger.error(`Erro na exclusao segura em ${String(model)}:`, error);
      throw error;
    }
  }

  /**
   * Prevent SQL injection in raw queries.
   */
  sanitizeRawQuery(query: string, params: unknown[]): string {
    return query.replace(/\$\d+/g, (match) => {
      const paramIndex = parseInt(match.slice(1), 10) - 1;
      const param = params[paramIndex];

      if (param === null || param === undefined) {
        return 'NULL';
      }

      if (typeof param === 'string') {
        return `'${param.replace(/'/g, "''")}'`;
      }

      if (typeof param === 'number') {
        return String(param);
      }

      if (param instanceof Date) {
        return `'${param.toISOString()}'`;
      }

      return `'${JSON.stringify(param).replace(/'/g, "''")}'`;
    });
  }

  /**
   * Execute raw query with sanitization.
   */
  async executeRawSecure(query: string, params: unknown[] = []): Promise<unknown> {
    try {
      const sanitizedQuery = this.sanitizeRawQuery(query, params);

      this.logger.debug('Executando query raw sanitizada', {
        queryPreview:
          sanitizedQuery.substring(0, 200) + (sanitizedQuery.length > 200 ? '...' : ''),
      });

      return await this.prisma.$executeRawUnsafe(sanitizedQuery, ...params);
    } catch (error) {
      this.logger.error('Erro na execucao de query raw:', error);
      throw error;
    }
  }

  /**
   * Usage stats placeholder for monitoring.
   */
  getUsageStats(): SecureUsageStats {
    return {
      timestamp: new Date().toISOString(),
    };
  }

  private getModelDelegate<T extends SecurePrismaRecord>(
    model: PrismaModelDelegateKey,
  ): SecurePrismaDelegate<T> {
    const delegate = (this.prisma as unknown as Record<string, unknown>)[model];
    if (!delegate || typeof delegate !== 'object') {
      throw new Error(`Delegate Prisma invalido para o modelo ${String(model)}`);
    }
    return delegate as SecurePrismaDelegate<T>;
  }

  private readRecordId(value: Record<string, unknown>): string | number | undefined {
    const id = value.id;
    return typeof id === 'string' || typeof id === 'number' ? id : undefined;
  }

  private readTenantId(value: Record<string, unknown>): string | null {
    return typeof value.tenantId === 'string' ? value.tenantId : null;
  }
}
