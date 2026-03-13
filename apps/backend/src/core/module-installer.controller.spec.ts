import { ModuleInstallerController } from './module-installer.controller';

describe('ModuleInstallerController database preparation aliases', () => {
  const installerMock = {
    listModules: jest.fn(),
    installModuleFromZip: jest.fn(),
    prepareModuleDatabase: jest.fn(),
    updateModuleDatabase: jest.fn(),
    runModuleMigrations: jest.fn(),
    runModuleSeeds: jest.fn(),
    runMigrationsAndSeeds: jest.fn(),
    activateModule: jest.fn(),
    deactivateModule: jest.fn(),
    uninstallModule: jest.fn(),
    reloadModuleConfig: jest.fn(),
  };
  const configResolverMock = {
    getResolved: jest.fn(),
  };

  const originalNodeEnv = process.env.NODE_ENV;
  const originalModuleUpload = process.env.ENABLE_MODULE_UPLOAD;

  const createController = () =>
    new ModuleInstallerController(installerMock as any, configResolverMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_MODULE_UPLOAD;
    configResolverMock.getResolved.mockResolvedValue({
      key: 'security.module_upload.enabled',
      value: false,
      source: 'default',
      definition: {
        key: 'security.module_upload.enabled',
        type: 'boolean',
      },
    });
    installerMock.installModuleFromZip.mockResolvedValue({ success: true });
    installerMock.prepareModuleDatabase.mockResolvedValue({ success: true });
    installerMock.updateModuleDatabase.mockResolvedValue({ success: true });
    installerMock.runModuleMigrations.mockResolvedValue({ success: true });
    installerMock.runModuleSeeds.mockResolvedValue({ success: true });
    installerMock.runMigrationsAndSeeds.mockResolvedValue({ success: true });
    installerMock.uninstallModule.mockResolvedValue({ success: true });
    installerMock.reloadModuleConfig.mockResolvedValue({ success: true });
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalModuleUpload === undefined) {
      delete process.env.ENABLE_MODULE_UPLOAD;
    } else {
      process.env.ENABLE_MODULE_UPLOAD = originalModuleUpload;
    }
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

  it('keeps mutable module operations blocked by default in production', async () => {
    const controller = createController();

    await expect(
      controller.uploadModule(
        {
          originalname: 'module.zip',
          buffer: Buffer.from('zip-buffer'),
        } as Express.Multer.File,
        {
          user: { id: 'admin-1' },
          ip: '127.0.0.1',
          headers: {
            'user-agent': 'jest',
          },
        } as any,
      ),
    ).rejects.toThrow(
      'Upload/uninstall/reload de modulos desabilitado fora de development. Defina ENABLE_MODULE_UPLOAD=true ou use o painel para liberar explicitamente.',
    );
  });

  it('uses ENV fallback to allow mutable module operations outside development', async () => {
    const controller = createController();
    configResolverMock.getResolved.mockResolvedValue({
      key: 'security.module_upload.enabled',
      value: true,
      source: 'env',
      definition: {
        key: 'security.module_upload.enabled',
        type: 'boolean',
      },
    });

    const result = await controller.uploadModule(
      {
        originalname: 'module.zip',
        buffer: Buffer.from('zip-buffer'),
      } as Express.Multer.File,
      {
        user: { id: 'admin-1' },
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'jest',
        },
      } as any,
    );

    expect(installerMock.installModuleFromZip).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true });
  });

  it('returns capability metadata based on the resolved dynamic setting source', async () => {
    const controller = createController();
    configResolverMock.getResolved.mockResolvedValue({
      key: 'security.module_upload.enabled',
      value: true,
      source: 'database',
      definition: {
        key: 'security.module_upload.enabled',
        type: 'boolean',
      },
    });

    await expect(controller.getCapabilities()).resolves.toEqual({
      environment: 'production',
      overrideEnabled: true,
      mutableModuleOpsAllowed: true,
      reason: 'explicit_override',
      message: 'Operacoes mutaveis de modulos liberadas por override dinamico salvo no painel.',
    });
  });

  it('keeps development semantics even when no override is present', async () => {
    const controller = createController();
    process.env.NODE_ENV = 'development';

    await expect(controller.getCapabilities()).resolves.toEqual({
      environment: 'development',
      overrideEnabled: false,
      mutableModuleOpsAllowed: true,
      reason: 'development',
      message: 'Operacoes mutaveis de modulos liberadas automaticamente em development.',
    });
  });
});
