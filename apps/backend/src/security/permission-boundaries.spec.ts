import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { PermissionController } from '../modules/ordem_servico/shared/controllers/permission.controller';
import { PermissionService } from '../modules/ordem_servico/shared/services/permission.service';

describe('Permission boundaries', () => {
  describe('PermissionController authorization', () => {
    const permissionServiceMock = {
      getAvailablePermissions: jest.fn(),
      getUsersWithPermissions: jest.fn(),
      getUserPermissions: jest.fn(),
      updateUserPermissions: jest.fn(),
      getPermissionAudit: jest.fn(),
    };

    const createController = () => new PermissionController(permissionServiceMock as any);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('protects permission updates with JWT and admin-level roles only', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, PermissionController) || [];
      const roles =
        Reflect.getMetadata(ROLES_KEY, PermissionController.prototype.updateUserPermissions) || [];

      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(roles).toEqual([Role.ADMIN, Role.SUPER_ADMIN]);
    });

    it('prevents a regular user from reading another users permissions', async () => {
      const controller = createController();

      await expect(
        controller.getUserPermissions(
          {
            user: {
              id: 'user-1',
              role: Role.USER,
              tenantId: 'tenant-1',
            },
          } as any,
          'user-2',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('PermissionService tenant isolation', () => {
    const prismaMock = {
      user: {
        findFirst: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
    };

    const createService = () => new PermissionService(prismaMock as any);

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('filters permission user listings by tenant', async () => {
      const service = createService();
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
        {
          id: 'user-1',
          name: 'Tenant User',
          email: 'user@example.com',
          role: 'USER',
        },
      ]);
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'user-1',
        role: 'USER',
      });

      await service.getUsersWithPermissions('tenant-1');

      expect(prismaMock.$queryRawUnsafe).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('WHERE tenant_id = $1'),
        'tenant-1',
      );
    });

    it('rejects permission changes for users outside the tenant', async () => {
      const service = createService();
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.updateUserPermissions(
          'tenant-1',
          'user-2',
          [{ resource: 'orders', action: 'edit', allowed: true }],
          'admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects explicit permission overrides for tenant admins', async () => {
      const service = createService();
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'admin-2',
        role: 'ADMIN',
      });

      await expect(
        service.updateUserPermissions(
          'tenant-1',
          'admin-2',
          [{ resource: 'orders', action: 'delete', allowed: true }],
          'admin-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
