import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { ROLES_KEY } from '@core/common/decorators/roles.decorator';
import { AuditController } from './audit.controller';

describe('AuditController', () => {
  const auditServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    getStats: jest.fn(),
    getRateLimitStats: jest.fn(),
    findRateLimitBlockedEvents: jest.fn(),
  };

  it('protects full audit endpoint with JWT + roles SUPER_ADMIN', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AuditController) || [];
    const roles = Reflect.getMetadata(ROLES_KEY, AuditController) || [];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual([Role.SUPER_ADMIN]);
  });

  it('delegates list query with parsed filters', async () => {
    const controller = new AuditController(auditServiceMock as any);
    const expected = { data: [], meta: { total: 0, page: 2, limit: 20, totalPages: 0 } };
    auditServiceMock.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(
      '2',
      '20',
      'UPDATE_FAILED',
      'user-1',
      'tenant-1',
      '2026-03-01T00:00:00.000',
      '2026-03-07T23:59:59.999',
    );

    expect(auditServiceMock.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      action: 'UPDATE_FAILED',
      userId: 'user-1',
      tenantId: 'tenant-1',
      startDate: new Date('2026-03-01T00:00:00.000'),
      endDate: new Date('2026-03-07T23:59:59.999'),
    });
    expect(result).toEqual(expected);
  });
});
