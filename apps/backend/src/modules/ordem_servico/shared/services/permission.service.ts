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

type ModuleProfile = 'admin' | 'technician' | 'attendant';

@Injectable()
export class PermissionService implements IPermissionService {
  private readonly logger = new Logger(PermissionService.name);
  private permissionCache = new Map<string, UserPermission[]>();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly profilePermissionCache = new Map<string, Record<string, Record<ModuleProfile, boolean>>>();
  private readonly PROFILE_CACHE_TTL = 5 * 60 * 1000;

  private readonly LEGACY_PROFILE_PERMISSION_MAP: Record<string, string> = {
    dashboard_export: 'dashboard_view_statistics',
    orders_assign: 'orders_change_status',
    config_users: 'config_manage_permissions',
    config_permissions: 'config_manage_permissions',
    config_system: 'config_edit',
  };

  constructor(private readonly prisma: PrismaService) {}

  async getUserPermissions(tenantId: string, userId: string): Promise<UserPermission[]> {
    await this.assertTenantContext(tenantId);
    await this.getTenantUserOrThrow(tenantId, userId);

    const cacheKey = `${tenantId}:${userId}`;
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey)!;
    }

    try {
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
      this.profilePermissionCache.delete(tenantId);
    } catch (error) {
      this.logger.error(`Erro ao atualizar permissoes do usuario ${userId}`, error as Error);
      throw error;
    }
  }

  async hasPermission(tenantId: string, userId: string, resource: string, action: string): Promise<boolean> {
    try {
      const users = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT role, name, email
         FROM users
         WHERE id = $1 AND "tenantId" = $2`,
        userId,
        tenantId,
      );

      const user = users[0];
      if (!user) {
        return false;
      }

      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        return true;
      }

      const permissions = await this.getUserPermissions(tenantId, userId);
      const explicitPermission = permissions.find(
        (item) => item.resource === resource && item.action === action,
      );

      if (explicitPermission) {
        if (!explicitPermission.allowed) {
          await this.logAccessDenied(tenantId, userId, resource, action);
        }
        return explicitPermission.allowed;
      }

      const permissionKey = this.buildProfilePermissionKey(resource, action);
      const profilePermissions = await this.getProfilePermissionsMatrix(tenantId);
      const userProfiles = await this.resolveUserProfiles(tenantId, userId);
      const permissionConfig = profilePermissions[permissionKey];
      const hasAccess = permissionConfig
        ? userProfiles.some((profile) => permissionConfig[profile] === true)
        : false;

      if (!hasAccess) {
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

      const users = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, email, role
         FROM users
         WHERE "tenantId" = $1
         ORDER BY name ASC`,
        tenantId,
      );

      const allPermissionActions = AVAILABLE_PERMISSIONS.flatMap((group) =>
        group.actions.map((action) => ({ resource: group.resource, action: action.action })),
      );

      const usersWithPermissions: UserWithPermissions[] = [];

      for (const user of users) {
        const permissions = await this.getUserPermissions(tenantId, user.id);
        const totalAvailablePermissions = allPermissionActions.length;

        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
          usersWithPermissions.push({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            permissions,
            permissionSummary: {
              total: totalAvailablePermissions,
              allowed: totalAvailablePermissions,
              denied: 0,
            },
          });
          continue;
        }

        let allowed = 0;
        for (const permission of allPermissionActions) {
          // eslint-disable-next-line no-await-in-loop
          const granted = await this.hasPermission(tenantId, user.id, permission.resource, permission.action);
          if (granted) {
            allowed += 1;
          }
        }

        usersWithPermissions.push({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions,
          permissionSummary: {
            total: totalAvailablePermissions,
            allowed,
            denied: totalAvailablePermissions - allowed,
          },
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

  private buildProfilePermissionKey(resource: string, action: string): string {
    return `${String(resource || '').trim()}_${String(action || '').trim()}`;
  }

  private normalizeProfilePermissionKey(rawKey: string): string {
    const key = String(rawKey || '').trim();
    return this.LEGACY_PROFILE_PERMISSION_MAP[key] || key;
  }

  private getDefaultProfilePermissions(): Record<string, Record<ModuleProfile, boolean>> {
    const defaults: Record<string, Record<ModuleProfile, boolean>> = {};

    const technicianDefaults = new Set<string>([
      'dashboard_view',
      'dashboard_view_statistics',
      'orders_view',
      'orders_view_details',
      'orders_create',
      'orders_edit',
      'orders_change_status',
      'orders_view_history',
      'clients_view',
      'clients_view_details',
      'clients_create',
      'clients_edit',
      'clients_upload_images',
      'products_view',
      'products_create',
      'products_edit',
      'products_upload_images',
      'config_view',
    ]);

    const attendantDefaults = new Set<string>([
      'dashboard_view',
      'orders_view',
      'orders_view_details',
      'orders_create',
      'clients_view',
      'clients_view_details',
      'clients_create',
      'clients_edit',
      'clients_upload_images',
      'products_view',
      'products_create',
      'products_edit',
      'products_upload_images',
    ]);

    for (const group of AVAILABLE_PERMISSIONS) {
      for (const action of group.actions) {
        const key = this.buildProfilePermissionKey(group.resource, action.action);
        defaults[key] = {
          admin: true,
          technician: technicianDefaults.has(key),
          attendant: attendantDefaults.has(key),
        };
      }
    }

    return defaults;
  }

  private async getProfilePermissionsMatrix(
    tenantId: string,
  ): Promise<Record<string, Record<ModuleProfile, boolean>>> {
    const cached = this.profilePermissionCache.get(tenantId);
    if (cached) {
      return cached;
    }

    const defaults = this.getDefaultProfilePermissions();

    try {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT tenant_id, profile, permission_id, allowed
         FROM mod_ordem_servico_profile_permissions
         WHERE tenant_id = $1 OR tenant_id = 'default'
         ORDER BY CASE WHEN tenant_id = 'default' THEN 0 ELSE 1 END, profile ASC, permission_id ASC`,
        tenantId,
      );

      const merged: Record<string, Record<ModuleProfile, boolean>> = { ...defaults };

      for (const row of rows) {
        const key = this.normalizeProfilePermissionKey(String(row.permission_id || ''));
        if (!key) {
          continue;
        }

        if (!merged[key]) {
          merged[key] = { admin: true, technician: false, attendant: false };
        }

        const profile = String(row.profile || '').toLowerCase();
        if (profile === 'admin' || profile === 'technician' || profile === 'attendant') {
          merged[key][profile] = Boolean(row.allowed);
        }
      }

      this.profilePermissionCache.set(tenantId, merged);
      setTimeout(() => {
        this.profilePermissionCache.delete(tenantId);
      }, this.PROFILE_CACHE_TTL);

      return merged;
    } catch (error) {
      this.logger.error(
        `Erro ao carregar permissoes por perfil do tenant ${tenantId}. Usando defaults.`,
        error as Error,
      );
      return defaults;
    }
  }

  private async resolveUserProfiles(tenantId: string, userId: string): Promise<ModuleProfile[]> {
    try {
      const roles = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT is_admin, is_technician, is_attendant
         FROM mod_ordem_servico_user_roles
         WHERE tenant_id = $1 AND user_id = $2
         LIMIT 1`,
        tenantId,
        userId,
      );

      const role = roles[0];
      if (!role) {
        return ['attendant'];
      }

      const profiles: ModuleProfile[] = [];
      if (Boolean(role.is_admin)) profiles.push('admin');
      if (Boolean(role.is_technician)) profiles.push('technician');
      if (Boolean(role.is_attendant) || profiles.length === 0) profiles.push('attendant');

      return profiles;
    } catch (error) {
      this.logger.error(
        `Erro ao resolver perfis do usuario ${userId} no tenant ${tenantId}. Aplicando fallback.`,
        error as Error,
      );
      return ['attendant'];
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
