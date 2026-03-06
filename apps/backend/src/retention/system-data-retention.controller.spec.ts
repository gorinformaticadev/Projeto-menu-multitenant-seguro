import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { ROLES_KEY } from '@core/common/decorators/roles.decorator';
import { SystemDataRetentionController } from './system-data-retention.controller';

describe('SystemDataRetentionController', () => {
  const retentionServiceMock = {
    runRetentionCleanup: jest.fn(),
  };

  const createController = () => new SystemDataRetentionController(retentionServiceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('protects endpoint with JWT + roles SUPER_ADMIN', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SystemDataRetentionController) || [];
    const roles = Reflect.getMetadata(ROLES_KEY, SystemDataRetentionController) || [];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual([Role.SUPER_ADMIN]);
  });

  it('runs retention manually and returns expected summary shape', async () => {
    const controller = createController();
    retentionServiceMock.runRetentionCleanup.mockResolvedValue({
      deletedAuditLogs: 123,
      deletedNotifications: 45,
      auditCutoff: new Date('2025-09-08T03:30:00.000Z'),
      notificationCutoff: new Date('2026-02-06T03:30:00.000Z'),
      auditRetentionDays: 180,
      notificationRetentionDays: 30,
      errors: [],
    });

    const result = await controller.runManually();

    expect(retentionServiceMock.runRetentionCleanup).toHaveBeenCalledWith('manual');
    expect(result).toEqual({
      deletedAuditLogs: 123,
      deletedNotifications: 45,
      auditCutoff: '2025-09-08T03:30:00.000Z',
      notificationCutoff: '2026-02-06T03:30:00.000Z',
    });
  });
});
