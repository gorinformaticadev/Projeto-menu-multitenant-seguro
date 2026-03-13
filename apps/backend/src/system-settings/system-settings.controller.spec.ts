import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { SystemSettingsController } from './system-settings.controller';

describe('SystemSettingsController', () => {
  const readServiceMock = {
    listPanelSettings: jest.fn(),
  };

  const createController = () => new SystemSettingsController(readServiceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('protege endpoint com JWT + role SUPER_ADMIN', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SystemSettingsController) || [];
    const roles = Reflect.getMetadata(ROLES_KEY, SystemSettingsController) || [];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual([Role.SUPER_ADMIN]);
  });

  it('delegates listagem ao service dedicado', async () => {
    const controller = createController();
    readServiceMock.listPanelSettings.mockResolvedValue({
      data: [],
      meta: {
        total: 0,
        categories: [],
      },
    });

    const result = await controller.listPanelSettings();

    expect(readServiceMock.listPanelSettings).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      data: [],
      meta: {
        total: 0,
        categories: [],
      },
    });
  });

  it('permite SUPER_ADMIN e bloqueia usuario sem permissao via RolesGuard', () => {
    const reflector = new Reflector();
    const telemetryMock = {
      recordSecurityEvent: jest.fn(),
    };
    const guard = new RolesGuard(reflector, telemetryMock as any);
    const handler = SystemSettingsController.prototype.listPanelSettings;
    const getClass = () => SystemSettingsController;

    const allowedContext = {
      getHandler: () => handler,
      getClass,
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            role: Role.SUPER_ADMIN,
          },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(allowedContext)).toBe(true);

    const deniedContext = {
      getHandler: () => handler,
      getClass,
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            role: Role.ADMIN,
          },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(deniedContext)).toThrow('Permissao insuficiente');
  });
});
