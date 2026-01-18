import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';

@Injectable()
export class SecurePrismaService {
  private readonly logger = new Logger(SecurePrismaService.name);
  
  constructor(private prisma: PrismaService) {
      // Empty implementation
    }

  /**
   * Wrapper seguro para findMany com validação automática de tenant isolation
   */
  async findManySecure<T>(
    model: keyof PrismaClient,
    where: any,
    tenantId: string,
    userRole: string,
    options: {
      select?: unknown;
      include?: unknown;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    } = {
      // Empty implementation
    }
  ): Promise<T[]> {
    try {
      // Aplicar tenant isolation automaticamente
      const tenantWhere = userRole !== 'SUPER_ADMIN' 
        ? { ...where, tenantId } 
        : where;

      // Adicionar logging de segurança para operações sensíveis
      this.logger.debug(`Busca segura em ${String(model)} para tenant ${tenantId}`, {
        userRole,
        whereKeys: object.keys(where),
        hasTenantFilter: userRole !== 'SUPER_ADMIN'
      });

      const result = await this.prisma[model].findMany({
        where: tenantWhere,
        select: options.select,
        include: options.include,
        orderBy: options.orderBy,
        skip: options.skip,
        take: options.take
      });

      return result as T[];
    } catch (error) {
      this.logger.error(`Erro na busca segura em ${String(model)}:`, error);
      throw error;
    }
  }

  /**
   * Wrapper seguro para findUnique com validação de ownership
   */
  async findUniqueSecure<T>(
    model: keyof PrismaClient,
    where: any,
    tenantId: string,
    userRole: string,
    options: {
      select?: unknown;
      include?: unknown;
    } = {
      // Empty implementation
    }
  ): Promise<T | null> {
    try {
      const result = await this.prisma[model].findUnique({
        where,
        select: options.select,
        include: options.include
      });

      if (!result) {
        return null;
      }

      // Para SUPER_ADMIN, permitir acesso a qualquer recurso
      if (userRole === 'SUPER_ADMIN') {
        this.logger.debug(`SUPER_ADMIN acessando recurso em ${String(model)}`, {
          resourceId: where.id,
          tenantId
        });
        return result as T;
      }

      // Verificar se o recurso pertence ao tenant do usuário
      const resourceTenantId = (result as any).tenantId;
      if (resourceTenantId !== tenantId) {
        this.logger.warn(`Tentativa de acesso cross-tenant bloqueada`, {
          model: String(model),
          resourceId: where.id,
          userTenant: tenantId,
          resourceTenant: resourceTenantId,
          userRole
        });
        return null; // Ou lançar exceção, dependendo da política
      }

      return result as T;
    } catch (error) {
      this.logger.error(`Erro na busca única segura em ${String(model)}:`, error);
      throw error;
    }
  }

  /**
   * Wrapper seguro para create com validação de tenant
   */
  async createSecure<T>(
    model: keyof PrismaClient,
    data: any,
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<T> {
    try {
      // Sempre associar o recurso ao tenant do usuário
      const secureData = {
        ...data,
        tenantId: userRole !== 'SUPER_ADMIN' ? tenantId : (data.tenantId || tenantId),
        createdBy: userId
      };

      this.logger.debug(`Criação segura em ${String(model)}`, {
        model: String(model),
        tenantId,
        userId,
        hasExplicitTenant: !!data.tenantId
      });

      const result = await this.prisma[model].create({
        data: secureData
      });

      // Logar criação para auditoria
      this.logger.log(`Recurso criado: ${String(model)}`, {
        id: (result as any).id,
        tenantId: (result as any).tenantId,
        createdBy: userId,
        timestamp: new Date().toISOString()
      });

      return result as T;
    } catch (error) {
      this.logger.error(`Erro na criação segura em ${String(model)}:`, error);
      throw error;
    }
  }

  /**
   * Wrapper seguro para update com validação de ownership
   */
  async updateSecure<T>(
    model: keyof PrismaClient,
    where: any,
    data: any,
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<T> {
    try {
      // Primeiro verificar se o recurso existe e pertence ao tenant
      const existing = await this.findUniqueSecure(
        model,
        where,
        tenantId,
        userRole
      );

      if (!existing) {
        throw new Error('Recurso não encontrado ou acesso não autorizado');
      }

      this.logger.debug(`Atualização segura em ${String(model)}`, {
        resourceId: where.id,
        tenantId,
        userId
      });

      const result = await this.prisma[model].update({
        where,
        data: {
          ...data,
          updatedBy: userId,
          updatedAt: new Date()
        }
      });

      // Logar atualização para auditoria
      this.logger.log(`Recurso atualizado: ${String(model)}`, {
        id: where.id,
        tenantId: (result as any).tenantId,
        updatedBy: userId,
        timestamp: new Date().toISOString()
      });

      return result as T;
    } catch (error) {
      this.logger.error(`Erro na atualização segura em ${String(model)}:`, error);
      throw error;
    }
  }

  /**
   * Wrapper seguro para delete com validação de ownership
   */
  async deleteSecure<T>(
    model: keyof PrismaClient,
    where: any,
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<T> {
    try {
      // Verificar ownership antes de deletar
      const existing = await this.findUniqueSecure(
        model,
        where,
        tenantId,
        userRole
      );

      if (!existing) {
        throw new Error('Recurso não encontrado ou acesso não autorizado');
      }

      this.logger.warn(`Exclusão segura em ${String(model)}`, {
        resourceId: where.id,
        tenantId,
        userId,
        userRole
      });

      const result = await this.prisma[model].delete({
        where
      });

      // Logar exclusão para auditoria
      this.logger.log(`Recurso excluído: ${String(model)}`, {
        id: where.id,
        tenantId: (result as any).tenantId,
        deletedBy: userId,
        timestamp: new Date().toISOString()
      });

      return result as T;
    } catch (error) {
      this.logger.error(`Erro na exclusão segura em ${String(model)}:`, error);
      throw error;
    }
  }

  /**
   * Previnir injeção de SQL em raw queries
   */
  sanitizeRawQuery(query: string, params: unknown[]): string {
    return query.replace(/\$\d+/g, (match, _index) => {
      const paramIndex = parseInt(match.slice(1)) - 1;
      const param = params[paramIndex];
      
      if (param === null || param === undefined) {
        return 'NULL';
      }
      
      if (typeof param === 'string') {
        // Escapar aspas simples
        return `'${param.replace(/'/g, "''")}'`;
      }
      
      if (typeof param === 'number') {
        return String(param);
      }
      
      if (param instanceof Date) {
        return `'${param.toISOString()}'`;
      }
      
      // Para objetos/arrays, converter para JSON
      return `'${JSON.stringify(param).replace(/'/g, "''")}'`;
    });
  }

  /**
   * Executar query raw com sanitização
   */
  async executeRawSecure(query: string, params: unknown[] = []): Promise<unknown> {
    try {
      const sanitizedQuery = this.sanitizeRawQuery(query, params);
      
      this.logger.debug('Executando query raw sanitizada', {
        queryPreview: sanitizedQuery.substring(0, 200) + (sanitizedQuery.length > 200 ? '...' : '')
      });

      // Em produção, usar prepared statements
      return await this.prisma.$executeRawUnsafe(sanitizedQuery, ...params);
    } catch (error) {
      this.logger.error('Erro na execução de query raw:', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas de uso para monitoramento
   */
  getUsageStats(): any {
    // Implementar coleta de métricas de uso do Prisma
    return {
      timestamp: new Date().toISOString(),
      // Adicionar métricas relevantes
    };
  }
}

// Tipo auxiliar para o PrismaClient
type PrismaClient = {
  [K in keyof typeof import('@prisma/client').PrismaClient]: unknown;
};