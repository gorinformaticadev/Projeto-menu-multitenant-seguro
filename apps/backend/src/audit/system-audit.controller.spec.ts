import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { ROLES_KEY } from '@core/common/decorators/roles.decorator';
import { SystemAuditController } from './system-audit.controller';

describe('SystemAuditController', () => {
  const auditServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  const createController = () => new SystemAuditController(auditServiceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('protects endpoint with JWT + roles ADMIN/SUPER_ADMIN', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SystemAuditController) || [];
    const roles = Reflect.getMetadata(ROLES_KEY, SystemAuditController) || [];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual([Role.ADMIN, Role.SUPER_ADMIN]);
  });

  it('parses query and delegates list to audit service', async () => {
    const controller = createController();
    const expected = { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } };
    auditServiceMock.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(
      '1',
      '10',
      'UPDATE_FAILED',
      'critical',
      'user-1',
      '2026-03-01T00:00:00.000Z',
      '2026-03-06T23:59:59.000Z',
    );

    expect(auditServiceMock.findAll).toHaveBeenCalledTimes(1);
    const args = auditServiceMock.findAll.mock.calls[0][0];
    expect(args).toMatchObject({
      page: 1,
      limit: 10,
      action: 'UPDATE_FAILED',
      allowedActionPrefixes: ['UPDATE_', 'MAINTENANCE_'],
      severity: 'critical',
      actorUserId: 'user-1',
    });
    expect(args.from).toBeInstanceOf(Date);
    expect(args.to).toBeInstanceOf(Date);
    expect(result).toEqual(expected);
  });

  it('delegates detail query by id', async () => {
    const controller = createController();
    auditServiceMock.findOne.mockResolvedValue({ id: 'audit-1', action: 'UPDATE_FAILED' });

    const result = await controller.findOne('audit-1');

    expect(auditServiceMock.findOne).toHaveBeenCalledWith('audit-1');
    expect(result).toEqual({ id: 'audit-1', action: 'UPDATE_FAILED' });
  });

  it('returns null for non-system actions on detail endpoint', async () => {
    const controller = createController();
    auditServiceMock.findOne.mockResolvedValue({ id: 'audit-2', action: 'AUTH_LOGIN_SUCCESS' });

    const result = await controller.findOne('audit-2');

    expect(auditServiceMock.findOne).toHaveBeenCalledWith('audit-2');
    expect(result).toBeNull();
  });
});
