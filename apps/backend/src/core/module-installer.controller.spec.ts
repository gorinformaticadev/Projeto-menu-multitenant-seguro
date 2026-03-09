import { ModuleInstallerController } from './module-installer.controller';

describe('ModuleInstallerController database preparation aliases', () => {
  const installerMock = {
    listModules: jest.fn(),
    prepareModuleDatabase: jest.fn(),
    updateModuleDatabase: jest.fn(),
    runModuleMigrations: jest.fn(),
    runModuleSeeds: jest.fn(),
    runMigrationsAndSeeds: jest.fn(),
    activateModule: jest.fn(),
    deactivateModule: jest.fn(),
  };

  const createController = () => new ModuleInstallerController(installerMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
    installerMock.prepareModuleDatabase.mockResolvedValue({ success: true });
    installerMock.updateModuleDatabase.mockResolvedValue({ success: true });
    installerMock.runModuleMigrations.mockResolvedValue({ success: true });
    installerMock.runModuleSeeds.mockResolvedValue({ success: true });
    installerMock.runMigrationsAndSeeds.mockResolvedValue({ success: true });
  });

  it('forwards actor context to the official prepare-database endpoint', async () => {
    const controller = createController();
    const req = {
      user: { id: 'admin-1' },
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'jest',
      },
    };

    await controller.prepareDatabase('ordem_servico', req as any);

    expect(installerMock.prepareModuleDatabase).toHaveBeenCalledWith('ordem_servico', {
      invokedBy: 'prepare-database',
      actor: {
        userId: 'admin-1',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
    });
  });

  it('forwards actor context through every legacy database alias', async () => {
    const controller = createController();
    const req = {
      user: { sub: 'admin-legacy' },
      ip: '10.0.0.5',
      headers: {
        'user-agent': 'legacy-client',
      },
    };

    await controller.updateDatabase('ordem_servico', req as any);
    await controller.runMigrations('ordem_servico', req as any);
    await controller.runSeeds('ordem_servico', req as any);
    await controller.runMigrationsAndSeeds('ordem_servico', req as any);

    const actor = {
      userId: 'admin-legacy',
      ipAddress: '10.0.0.5',
      userAgent: 'legacy-client',
    };

    expect(installerMock.updateModuleDatabase).toHaveBeenCalledWith('ordem_servico', actor);
    expect(installerMock.runModuleMigrations).toHaveBeenCalledWith('ordem_servico', actor);
    expect(installerMock.runModuleSeeds).toHaveBeenCalledWith('ordem_servico', actor);
    expect(installerMock.runMigrationsAndSeeds).toHaveBeenCalledWith('ordem_servico', actor);
  });
});
