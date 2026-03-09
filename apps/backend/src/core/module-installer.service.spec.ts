import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ModuleInstallerService } from './module-installer.service';

describe('ModuleInstallerService module lifecycle hardening', () => {
  const prismaMock = {
    module: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    moduleMigration: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    moduleMenu: {
      deleteMany: jest.fn(),
    },
  };

  const notificationServiceMock = {
    create: jest.fn(),
  };

  const dbExecutorMock = {
    executeInTransaction: jest.fn(),
  };

  const auditServiceMock = {
    log: jest.fn(),
  };

  const pathsServiceMock = {
    getUploadsDir: jest.fn(),
  };

  const createService = () => {
    const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'module-installer-spec-'));
    pathsServiceMock.getUploadsDir.mockReturnValue(uploadsDir);
    return new ModuleInstallerService(
      prismaMock as any,
      notificationServiceMock as any,
      dbExecutorMock as any,
      auditServiceMock as any,
      pathsServiceMock as any,
    );
  };

  const validManifest = {
    name: 'ordem_servico',
    displayName: 'Ordem de Servico',
    version: '3.1.0',
    description: 'Modulo de teste',
    author: 'Teste',
    category: 'custom',
    enabled: true,
    dependencies: [],
    icon: 'Box',
    menus: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.module.findMany.mockResolvedValue([]);
    auditServiceMock.log.mockResolvedValue(undefined);
  });

  it('uses prepareModuleDatabase as the official pipeline and records actor context', async () => {
    const service = createService();
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(service as any, 'getPhysicalIntegrity').mockReturnValue({
      valid: true,
      issues: [],
      manifestIntegrity: {
        valid: true,
        detail: 'module.json valido',
        manifest: validManifest,
      },
    });
    jest.spyOn(service as any, 'ensureDependenciesPrepared').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'assertPendingSeedsAreSafe').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'executeMigrationsOneByOne')
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    prismaMock.module.findUnique.mockResolvedValue({
      id: 'module-1',
      slug: 'ordem_servico',
      name: 'Ordem de Servico',
      status: 'installed',
      hasBackend: true,
      hasFrontend: false,
    });
    prismaMock.module.update.mockResolvedValue({
      id: 'module-1',
      slug: 'ordem_servico',
      status: 'db_ready',
    });

    const result = await service.prepareModuleDatabase('ordem_servico', {
      actor: {
        userId: 'admin-1',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
    });

    expect((service as any).executeMigrationsOneByOne).toHaveBeenNthCalledWith(
      1,
      'ordem_servico',
      expect.stringContaining(path.join('src', 'modules', 'ordem_servico')),
      'migration',
    );
    expect((service as any).executeMigrationsOneByOne).toHaveBeenNthCalledWith(
      2,
      'ordem_servico',
      expect.stringContaining(path.join('src', 'modules', 'ordem_servico')),
      'seed',
    );
    expect(prismaMock.module.update).toHaveBeenCalledWith({
      where: { slug: 'ordem_servico' },
      data: { status: 'db_ready' },
    });
    expect(auditServiceMock.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'MODULE_DB_PREPARE_STARTED',
      userId: 'admin-1',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    }));
    expect(result).toMatchObject({
      success: true,
      officialOperation: 'prepare-module-database',
      module: {
        slug: 'ordem_servico',
        status: 'db_ready',
        migrationsExecuted: 2,
        seedsExecuted: 1,
      },
    });

    existsSyncSpy.mockRestore();
  });

  it('keeps legacy database methods delegating to the official pipeline', async () => {
    const service = createService();
    const prepareSpy = jest.spyOn(service, 'prepareModuleDatabase').mockResolvedValue({
      success: true,
      officialOperation: 'prepare-module-database',
      message: 'ok',
      module: {
        slug: 'ordem_servico',
        status: 'db_ready',
        migrationsExecuted: 3,
        seedsExecuted: 2,
      },
      checks: {
        integrity: 'ready',
        dependencies: 'ready',
      },
    });

    await service.runModuleMigrations('ordem_servico', { userId: 'admin-1' });
    await service.runModuleSeeds('ordem_servico', { userId: 'admin-1' });
    await service.updateModuleDatabase('ordem_servico', { userId: 'admin-1' });
    await service.runMigrationsAndSeeds('ordem_servico', { userId: 'admin-1' });

    expect(prepareSpy).toHaveBeenNthCalledWith(1, 'ordem_servico', {
      invokedBy: 'legacy-run-migrations',
      actor: { userId: 'admin-1' },
    });
    expect(prepareSpy).toHaveBeenNthCalledWith(2, 'ordem_servico', {
      invokedBy: 'legacy-run-seeds',
      actor: { userId: 'admin-1' },
    });
    expect(prepareSpy).toHaveBeenNthCalledWith(3, 'ordem_servico', {
      invokedBy: 'legacy-update-db',
      actor: { userId: 'admin-1' },
    });
    expect(prepareSpy).toHaveBeenNthCalledWith(4, 'ordem_servico', {
      invokedBy: 'legacy-run-migrations-seeds',
      actor: { userId: 'admin-1' },
    });
  });

  it('blocks activation when manifest integrity is invalid', async () => {
    const service = createService();
    jest.spyOn(service as any, 'getPhysicalIntegrity').mockReturnValue({
      valid: false,
      issues: ['manifest (module.json invalido)'],
      manifestIntegrity: {
        valid: false,
        detail: 'module.json invalido',
        manifest: null,
      },
    });
    jest.spyOn(service as any, 'getFrontendReadiness').mockReturnValue({
      inspectMode: 'not_required',
      validationLevel: 'not_required',
      ready: true,
      detail: 'Modulo sem frontend.',
    });
    prismaMock.module.findUnique.mockResolvedValue({
      id: 'module-1',
      slug: 'ordem_servico',
      name: 'Ordem de Servico',
      status: 'db_ready',
      hasBackend: true,
      hasFrontend: false,
    });

    await expect(service.activateModule('ordem_servico')).rejects.toThrow(BadRequestException);
    await expect(service.activateModule('ordem_servico')).rejects.toThrow(/Integridade inválida/i);
  });

  it('treats disabled dependencies as not satisfied during database preparation', async () => {
    const service = createService();
    const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(service as any, 'getPhysicalIntegrity').mockReturnValue({
      valid: true,
      issues: [],
      manifestIntegrity: {
        valid: true,
        detail: 'module.json valido',
        manifest: {
          ...validManifest,
          dependencies: ['base_module'],
        },
      },
    });

    prismaMock.module.findUnique
      .mockResolvedValueOnce({
        id: 'module-1',
        slug: 'ordem_servico',
        name: 'Ordem de Servico',
        status: 'installed',
        hasBackend: true,
        hasFrontend: false,
      })
      .mockResolvedValueOnce({
        id: 'module-2',
        slug: 'base_module',
        status: 'disabled',
      });

    await expect(service.prepareModuleDatabase('ordem_servico')).rejects.toThrow(/base_module/i);
    expect(prismaMock.module.update).not.toHaveBeenCalled();

    existsSyncSpy.mockRestore();
  });

  it('blocks unsafe pending seeds with plain INSERT', async () => {
    const service = createService();
    const modulePath = fs.mkdtempSync(path.join(os.tmpdir(), 'module-seed-check-'));
    const seedsPath = path.join(modulePath, 'seeds');
    fs.mkdirSync(seedsPath, { recursive: true });
    fs.writeFileSync(
      path.join(seedsPath, '001_bad_seed.sql'),
      'INSERT INTO module_permissions (id, name) VALUES (1, \'seed inseguro\');',
      'utf-8',
    );

    prismaMock.module.findUnique.mockResolvedValue({
      id: 'module-1',
      slug: 'ordem_servico',
    });
    prismaMock.moduleMigration.findUnique.mockResolvedValue(null);

    await expect((service as any).assertPendingSeedsAreSafe('ordem_servico', modulePath)).rejects.toThrow(
      /Seed inseguro bloqueado/i,
    );
  });
});
