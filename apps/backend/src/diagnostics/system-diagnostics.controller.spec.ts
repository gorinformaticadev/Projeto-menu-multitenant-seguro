import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { SystemDiagnosticsController } from './system-diagnostics.controller';

describe('SystemDiagnosticsController', () => {
  const diagnosticsServiceMock = {
    getDiagnostics: jest.fn(),
  };

  const createController = () => new SystemDiagnosticsController(diagnosticsServiceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('protects diagnostics with JWT + roles ADMIN/SUPER_ADMIN', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SystemDiagnosticsController) || [];
    const roles = Reflect.getMetadata(ROLES_KEY, SystemDiagnosticsController) || [];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual([Role.ADMIN, Role.SUPER_ADMIN]);
  });

  it('delegates diagnostics query with normalized actor context', async () => {
    const controller = createController();
    diagnosticsServiceMock.getDiagnostics.mockResolvedValue({ overall: { level: 'healthy' } });

    await controller.getDiagnostics({
      user: {
        sub: 'user-1',
        role: 'ADMIN',
        tenantId: 'tenant-1',
        name: 'Admin User',
        email: 'admin@example.com',
        tenantName: 'Tenant XPTO',
      },
    });

    expect(diagnosticsServiceMock.getDiagnostics).toHaveBeenCalledWith({
      userId: 'user-1',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
      name: 'Admin User',
      email: 'admin@example.com',
      tenantName: 'Tenant XPTO',
    });
  });
});
