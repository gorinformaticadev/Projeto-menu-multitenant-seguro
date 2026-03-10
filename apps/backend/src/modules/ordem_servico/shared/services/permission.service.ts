import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import {
  AvailablePermission,
  IPermissionService,
  PermissionAudit,
  PermissionUpdate,
  UserPermission,
  UserWithPermissions,
} from '../interfaces/permission.interface';
import { AVAILABLE_PERMISSIONS } from '../constants/available-permissions';

@Injectable()
export class PermissionService implements IPermissionService {
  private readonly logger = new Logger(PermissionService.name);
  private permissionCache = new Map<string, UserPermission[]>();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  async getUserPermissions(tenantId: string, userId: string): Promise<UserPermission[]> {
    await this.assertTenantContext(tenantId);
    await this.getTenantUserOrThrow(tenantId, userId);

    const cacheKey = `${tenantId}:${userId}`;
    if (this.permissionCache.has(cacheKey)) {
      this.logger.log(`Permissoes encontradas no cache para usuario ${userId}`);
      return this.permissionCache.get(cacheKey)!;
    }

    try {
      this.logger.log(`Buscando permissoes para usuario ${userId} no tenant ${tenantId}`);

      const permissions = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT
          id, user_id, tenant_id, resource, action, allowed,
          created_at, updated_at, created_by
         FROM mod_ordem_servico_user_permissions
         WHERE tenant_id = $1 AND user_id = $2
         ORDER BY resource, action`,
        tenantId,
        userId,
      );

      const userPermissions: UserPermission[] = permissions.map((permission) => ({
        id: permission.id,
        userId: permission.user_id,
        tenantId: permission.tenant_id,
        resource: permission.resource,
        action: permission.action,
        allowed: permission.allowed,
        createdAt: permission.created_at,
        updatedAt: permission.updated_at,
        createdBy: permission.created_by,
      }));

      this.permissionCache.set(cacheKey, userPermissions);
      setTimeout(() => {
        this.permissionCache.delete(cacheKey);
      }, this.CACHE_TTL);

      this.logger.log(`Permissoes carregadas para usuario ${userId}: ${userPermissions.length}`);
      return userPermissions;
    } catch (error) {
      this.logger.error(`Erro ao buscar permissoes do usuario ${userId}`, error as Error);
      throw error;
    }
  }

  async updateUserPermissions(
    tenantId: string,
    userId: string,
    permissions: PermissionUpdate[],
    changedBy: string,
  ): Promise<void> {
    try {
      await this.assertTenantContext(tenantId);
      const targetUser = await this.getTenantUserOrThrow(tenantId, userId);

      if (targetUser.role === 'ADMIN' || targetUser.role === 'SUPER_ADMIN') {
        throw new ForbiddenException('Permissoes explicitas nao podem sobrescrever papeis administrativos');
      }

      this.logger.log(`Atualizando ${permissions.length} permissoes para usuario ${userId}`);

      const currentPermissions = await this.getUserPermissions(tenantId, userId);

      for (const permission of permissions) {
        const current = currentPermissions.find(
          (item) => item.resource === permission.resource && item.action === permission.action,
        );

        if (current) {
          if (current.allowed !== permission.allowed) {
            await this.prisma.$executeRawUnsafe(
              `UPDATE mod_ordem_servico_user_permissions
               SET allowed = $3, updated_at = NOW()
               WHERE tenant_id = $1 AND user_id = $2 AND resource = $4 AND action = $5`,
              tenantId,
              userId,
              permission.allowed,
              permission.resource,
              permission.action,
            );

            await this.logPermissionChange(
              tenantId,
              userId,
              permission.resource,
              permission.action,
              current.allowed,
              permission.allowed,
              changedBy,
            );
          }
        } else {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO mod_ordem_servico_user_permissions
             (tenant_id, user_id, resource, action, allowed, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            tenantId,
            userId,
            permission.resource,
            permission.action,
            permission.allowed,
            changedBy,
          );

          await this.logPermissionChange(
            tenantId,
            userId,
            permission.resource,
            permission.action,
            null,
            permission.allowed,
            changedBy,
          );
        }
      }

      this.permissionCache.delete(`${tenantId}:${userId}`);
      this.logger.log(`Permissoes atualizadas com sucesso para usuario ${userId}`);
    } catch (error) {
      this.logger.error(`Erro ao atualizar permissoes do usuario ${userId}`, error as Error);
      throw error;
    }
  }

  async hasPermission(tenantId: string, userId: string, resource: string, action: string): Promise<boolean> {
    try {
      const users = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT role, name, email FROM users WHERE id = $1`,
        userId,
      );

      const user = users[0];
      if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
        this.logger.log(`Bypass admin para ${resource}:${action} por ${user.email}`);
        return true;
      }

      const permissions = await this.getUserPermissions(tenantId, userId);
      const permission = permissions.find((item) => item.resource === resource && item.action === action);
      const hasAccess = permission?.allowed || false;

      if (!hasAccess) {
        this.logger.warn(`Acesso negado para usuario ${userId} em ${resource}:${action}`);
        await this.logAccessDenied(tenantId, userId, resource, action);
      }

      return hasAccess;
    } catch (error) {
      this.logger.error(`Erro ao verificar permissao ${resource}:${action} para usuario ${userId}`, error as Error);
      return false;
    }
  }

  getAvailablePermissions(): AvailablePermission[] {
    return AVAILABLE_PERMISSIONS;
  }

  async getUsersWithPermissions(tenantId: string): Promise<UserWithPermissions[]> {
    try {
      await this.assertTenantContext(tenantId);
      this.logger.log(`Buscando usuarios com permissoes para tenant ${tenantId}`);

      const users = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, email, role
         FROM users
         WHERE tenant_id = $1
         ORDER BY name ASC`,
        tenantId,
      );

      const usersWithPermissions: UserWithPermissions[] = [];

      for (const user of users) {
        const permissions = await this.getUserPermissions(tenantId, user.id);

        let permissionSummary;
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
          const totalAvailablePermissions = AVAILABLE_PERMISSIONS.reduce(
            (total, group) => total + group.actions.length,
            0,
          );

          permissionSummary = {
            total: totalAvailablePermissions,
            allowed: totalAvailablePermissions,
            denied: 0,
          };
        } else {
          permissionSummary = {
            total: permissions.length,
            allowed: permissions.filter((item) => item.allowed).length,
            denied: permissions.filter((item) => !item.allowed).length,
          };
        }

        usersWithPermissions.push({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions,
          permissionSummary,
        });
      }

      return usersWithPermissions;
    } catch (error) {
      this.logger.error('Erro ao buscar usuarios com permissoes', error as Error);
      throw error;
    }
  }

  async getPermissionAudit(
    tenantId: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PermissionAudit[]> {
    try {
      await this.assertTenantContext(tenantId);

      if (userId) {
        await this.getTenantUserOrThrow(tenantId, userId);
      }

      let query = `
        SELECT id, tenant_id, user_id, resource, action, old_value, new_value,
               changed_by, changed_at, reason
        FROM mod_ordem_servico_permission_audit
        WHERE tenant_id = $1
      `;
      const params: any[] = [tenantId];

      if (userId) {
        query += ` AND user_id = $${params.length + 1}`;
        params.push(userId);
      }

      if (startDate) {
        query += ` AND changed_at >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND changed_at <= $${params.length + 1}`;
        params.push(endDate);
      }

      query += ` ORDER BY changed_at DESC LIMIT 1000`;

      const audits = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);

      return audits.map((audit) => ({
        id: audit.id,
        tenantId: audit.tenant_id,
        userId: audit.user_id,
        resource: audit.resource,
        action: audit.action,
        oldValue: audit.old_value,
        newValue: audit.new_value,
        changedBy: audit.changed_by,
        changedAt: audit.changed_at,
        reason: audit.reason,
      }));
    } catch (error) {
      this.logger.error('Erro ao buscar auditoria de permissoes', error as Error);
      throw error;
    }
  }

  private async logPermissionChange(
    tenantId: string,
    userId: string,
    resource: string,
    action: string,
    oldValue: boolean | null,
    newValue: boolean,
    changedBy: string,
    reason?: string,
  ): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO mod_ordem_servico_permission_audit
         (tenant_id, user_id, resource, action, old_value, new_value, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        tenantId,
        userId,
        resource,
        action,
        oldValue,
        newValue,
        changedBy,
        reason,
      );
    } catch (error) {
      this.logger.error('Erro ao registrar auditoria de permissao', error as Error);
    }
  }

  private async logAccessDenied(
    tenantId: string,
    userId: string,
    resource: string,
    action: string,
  ): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO mod_ordem_servico_permission_audit
         (tenant_id, user_id, resource, action, old_value, new_value, changed_by, reason)
         VALUES ($1, $2, $3, $4, null, false, $2, 'ACCESS_DENIED')`,
        tenantId,
        userId,
        resource,
        action,
      );
    } catch (error) {
      this.logger.error('Erro ao registrar tentativa de acesso negado', error as Error);
    }
  }

  private async assertTenantContext(tenantId: string): Promise<void> {
    if (!tenantId) {
      throw new BadRequestException('Operacao exige tenant valido');
    }
  }

  private async getTenantUserOrThrow(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado neste tenant');
    }

    return user;
  }
}
