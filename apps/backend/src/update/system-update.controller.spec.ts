import { GUARDS_METADATA } from '@nestjs/common/constants';
import { HttpException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { SystemUpdateController } from './system-update.controller';

describe('SystemUpdateController platform boundary', () => {
  const serviceMock = {
    runUpdate: jest.fn(),
    getStatus: jest.fn(),
    getLogTail: jest.fn(),
    runRollback: jest.fn(),
    listReleases: jest.fn(),
  };

  const terminalUpdateRunnerServiceMock = {
    start: jest.fn(),
    getStatus: jest.fn(),
    getLogTail: jest.fn(),
  };

  const capabilitiesServiceMock = {
    getCapabilities: jest.fn(() => ({
      sourceOfTruth: 'canonical_db',
      updateAgent: {
        enabled: true,
        legacyBridgeEnabled: true,
      },
      canonicalReadEnabled: true,
      runtimeAdapters: [],
    })),
  };

  const updateServiceMock = {
    getUpdateStatus: jest.fn().mockResolvedValue({
      effectiveMode: 'docker',
    }),
  };

  const createController = () =>
    new SystemUpdateController(
      serviceMock as any,
      capabilitiesServiceMock as any,
      terminalUpdateRunnerServiceMock as any,
      updateServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('restricts update and rollback operations to platform SUPER_ADMIN only', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SystemUpdateController) || [];
    const roles = Reflect.getMetadata(ROLES_KEY, SystemUpdateController) || [];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual([Role.SUPER_ADMIN]);
  });

  it('passes audit context when running a platform update', async () => {
    const controller = createController();
    terminalUpdateRunnerServiceMock.start.mockResolvedValue({ started: true });

    await controller.run(
      {} as any,
      {
        user: {
          id: 'super-1',
          email: 'super@example.com',
          role: Role.SUPER_ADMIN,
        },
        requestContext: {
          ip: '10.0.0.1',
          userAgent: 'jest',
        },
        ip: '10.0.0.1',
        headers: {
          'user-agent': 'jest',
        },
      } as any,
    );

    expect(terminalUpdateRunnerServiceMock.start).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'super-1',
        userRole: Role.SUPER_ADMIN,
      }),
    );
  });

  it('bloqueia execucao via painel quando a instalacao efetiva e native', async () => {
    const controller = createController();
    updateServiceMock.getUpdateStatus.mockResolvedValueOnce({
      effectiveMode: 'native',
    });

    await expect(
      controller.run(
        {} as any,
        {
          user: {
            id: 'super-1',
            email: 'super@example.com',
            role: Role.SUPER_ADMIN,
          },
        } as any,
      ),
    ).rejects.toBeInstanceOf(HttpException);

    expect(terminalUpdateRunnerServiceMock.start).not.toHaveBeenCalled();
  });

  it('expõe as capacidades do engine canonico sem depender do controller legado', async () => {
    const controller = createController();

    await controller.capabilities();

    expect(capabilitiesServiceMock.getCapabilities).toHaveBeenCalled();
  });
});
