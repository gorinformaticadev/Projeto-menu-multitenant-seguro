import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ModuleInstallerService } from './module-installer.service';
import { ModuleStructureValidator } from './validators/module-structure.validator';

describe('ModuleInstallerService module lifecycle and npm dependencies', () => {
  const prismaMock = {
    module: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    moduleMigration: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    moduleMenu: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    moduleNpmDependency: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
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

  const defaultNpmSummary = {
    backend: [],
    frontend: [],
    total: 0,
    pending: 0,
    installed: 0,
    conflicts: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.module.findMany.mockResolvedValue([]);
    prismaMock.module.update.mockResolvedValue(undefined);
    prismaMock.module.create.mockResolvedValue({ id: 'module-1', slug: 'ordem_servico' });
    auditServiceMock.log.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
    jest
      .spyOn(service as any, 'executeMigrationsOneByOne')
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    prismaMock.module.findUnique.mockResolvedValue({
      id: 'module-1',
      slug: 'ordem_servico',
      name: 'Ordem de Servico',
      status: 'dependencies_installed',
      hasBackend: true,
      hasFrontend: false,
    });
    prismaMock.module.update.mockResolvedValue({
      id: 'module-1',
      slug: 'ordem_servico',
      status: 'ready',
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
      data: { status: 'ready' },
    });
    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MODULE_DB_PREPARE_STARTED',
        userId: 'admin-1',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      }),
    );
    expect(result).toMatchObject({
      success: true,
      officialOperation: 'prepare-module-database',
      module: {
        slug: 'ordem_servico',
        status: 'ready',
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
        status: 'ready',
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
      status: 'ready',
      hasBackend: true,
      hasFrontend: false,
      npmDependencies: [],
    });

    await expect(service.activateModule('ordem_servico')).rejects.toThrow(/integridade/i);
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
        status: 'dependencies_installed',
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
      "INSERT INTO module_permissions (id, name) VALUES (1, 'seed inseguro');",
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

  it('installs uploaded module without npm dependencies and marks dependencies_installed', async () => {
    const service = createService();
    jest.spyOn(ModuleStructureValidator, 'analyzeZipStructure').mockReturnValue({
      basePath: '',
      moduleJsonContent: JSON.stringify(validManifest),
      files: ['module.json'],
      hasBackend: true,
      hasFrontend: true,
    });

    jest.spyOn(service as any, 'distributeModuleFiles').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'registerModuleInDatabase').mockResolvedValue({
      id: 'module-1',
      slug: 'ordem_servico',
    });
    jest.spyOn(service as any, 'registerModuleMenus').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'syncModuleNpmDependencies').mockResolvedValue({
      summary: defaultNpmSummary,
      conflicts: [],
      added: [],
      installExecuted: false,
    });
    jest.spyOn(service as any, 'notifyModuleInstalled').mockResolvedValue(undefined);

    prismaMock.module.findUnique.mockResolvedValue(null);

    const result = await service.installModuleFromZip({
      originalname: 'module.zip',
      buffer: Buffer.from('zip-buffer'),
      size: 1200,
    } as Express.Multer.File);

    expect(prismaMock.module.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'module-1' },
      data: { status: 'pending_dependencies' },
    });
    expect(prismaMock.module.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'module-1' },
      data: { status: 'dependencies_installed' },
    });
    expect(result).toMatchObject({
      success: true,
      module: {
        name: 'ordem_servico',
        status: 'dependencies_installed',
      },
    });
  });

  it('accepts valid npmDependencies from module upload and forwards normalized dependencies', async () => {
    const service = createService();
    jest.spyOn(ModuleStructureValidator, 'analyzeZipStructure').mockReturnValue({
      basePath: '',
      moduleJsonContent: JSON.stringify({
        ...validManifest,
        npmDependencies: {
          backend: {
            axios: '^1.7.2',
          },
          frontend: {
            '@tanstack/react-query': '^5.59.0',
          },
        },
      }),
      files: ['module.json'],
      hasBackend: true,
      hasFrontend: true,
    });

    jest.spyOn(service as any, 'distributeModuleFiles').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'registerModuleInDatabase').mockResolvedValue({
      id: 'module-1',
      slug: 'ordem_servico',
    });
    jest.spyOn(service as any, 'registerModuleMenus').mockResolvedValue(undefined);
    const syncSpy = jest.spyOn(service as any, 'syncModuleNpmDependencies').mockResolvedValue({
      summary: {
        backend: [
          { packageName: 'axios', version: '^1.7.2', target: 'backend', status: 'installed', note: null },
        ],
        frontend: [
          {
            packageName: '@tanstack/react-query',
            version: '^5.59.0',
            target: 'frontend',
            status: 'installed',
            note: null,
          },
        ],
        total: 2,
        pending: 0,
        installed: 2,
        conflicts: 0,
      },
      conflicts: [],
      added: [],
      installExecuted: true,
    });
    jest.spyOn(service as any, 'notifyModuleInstalled').mockResolvedValue(undefined);

    prismaMock.module.findUnique.mockResolvedValue(null);

    await service.installModuleFromZip({
      originalname: 'module.zip',
      buffer: Buffer.from('zip-buffer'),
      size: 1200,
    } as Express.Multer.File);

    expect(syncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: 'module-1',
        moduleSlug: 'ordem_servico',
        dependencies: expect.arrayContaining([
          { target: 'backend', packageName: 'axios', version: '^1.7.2' },
          {
            target: 'frontend',
            packageName: '@tanstack/react-query',
            version: '^5.59.0',
          },
        ]),
      }),
    );
  });

  it('blocks upload when module declares invalid npm dependency version', async () => {
    const service = createService();
    jest.spyOn(ModuleStructureValidator, 'analyzeZipStructure').mockReturnValue({
      basePath: '',
      moduleJsonContent: JSON.stringify({
        ...validManifest,
        npmDependencies: {
          backend: {
            axios: 'latest',
          },
        },
      }),
      files: ['module.json'],
      hasBackend: true,
      hasFrontend: true,
    });

    const distributeSpy = jest.spyOn(service as any, 'distributeModuleFiles').mockResolvedValue(undefined);

    await expect(
      service.installModuleFromZip({
        originalname: 'module.zip',
        buffer: Buffer.from('zip-buffer'),
        size: 1200,
      } as Express.Multer.File),
    ).rejects.toThrow(/MODULE_DEPENDENCY_VALIDATION_FAILED/);

    expect(distributeSpy).not.toHaveBeenCalled();
  });

  it('marks module as dependency_conflict when npm conflict is reported by sync stage', async () => {
    const service = createService();
    jest.spyOn(ModuleStructureValidator, 'analyzeZipStructure').mockReturnValue({
      basePath: '',
      moduleJsonContent: JSON.stringify(validManifest),
      files: ['module.json'],
      hasBackend: true,
      hasFrontend: true,
    });

    jest.spyOn(service as any, 'distributeModuleFiles').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'registerModuleInDatabase').mockResolvedValue({
      id: 'module-1',
      slug: 'ordem_servico',
    });
    jest.spyOn(service as any, 'registerModuleMenus').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'syncModuleNpmDependencies').mockResolvedValue({
      summary: {
        backend: [{ packageName: 'zod', version: '^4.0.0', target: 'backend', status: 'conflict', note: 'Conflito' }],
        frontend: [],
        total: 1,
        pending: 0,
        installed: 0,
        conflicts: 1,
      },
      conflicts: [{ packageName: 'zod', version: '^4.0.0', target: 'backend', status: 'conflict', note: 'Conflito' }],
      added: [],
      installExecuted: false,
    });
    jest.spyOn(service as any, 'notifyModuleInstalled').mockResolvedValue(undefined);

    prismaMock.module.findUnique.mockResolvedValue(null);

    const result = await service.installModuleFromZip({
      originalname: 'module.zip',
      buffer: Buffer.from('zip-buffer'),
      size: 1200,
    } as Express.Multer.File);

    expect(prismaMock.module.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'module-1' },
      data: { status: 'dependency_conflict' },
    });
    expect(result).toMatchObject({
      success: true,
      module: {
        status: 'dependency_conflict',
      },
    });
    expect(String(result.message)).toMatch(/conflitos/i);
  });
});
