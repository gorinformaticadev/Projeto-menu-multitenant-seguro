import { ModuleInstallerController } from './module-installer.controller';
import { ConfigResolverService } from '../system-settings/config-resolver.service';
import { SettingsRegistry } from '../system-settings/settings-registry.service';
import { SystemSettingsAuditService } from '../system-settings/system-settings-audit.service';
import { SystemSettingsWriteService } from '../system-settings/system-settings-write.service';

type StoredSettingRecord = {
  key: string;
  valueJson: unknown;
  valueType: string;
  category: string;
  scope: string;
  tenantId: string | null;
  source: string;
  updatedByUserId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type InMemoryPrisma = {
  store: Map<string, StoredSettingRecord>;
  audits: Array<Record<string, unknown>>;
  systemSetting: {
    findUnique: jest.Mock<Promise<any>, [any]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: any) => Promise<unknown>]>;
};

const actor = {
  userId: 'super-admin-1',
  email: 'super-admin@example.com',
};

const requestMock = {
  user: { id: 'super-admin-1' },
  ip: '127.0.0.1',
  headers: {
    'user-agent': 'jest',
  },
};

const fileMock = {
  originalname: 'module.zip',
  buffer: Buffer.from('zip-buffer'),
} as Express.Multer.File;

const createInMemoryPrisma = (databaseAvailable = true): InMemoryPrisma => {
  const store = new Map<string, StoredSettingRecord>();
  const audits: Array<Record<string, unknown>> = [];

  const ensureAvailable = () => {
    if (!databaseAvailable) {
      throw new Error('db offline');
    }
  };

  const cloneRecord = (record: StoredSettingRecord | undefined): StoredSettingRecord | null => {
    if (!record) {
      return null;
    }

    return {
      ...record,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  };

  const projectRecord = (record: StoredSettingRecord | null, args: any) => {
    if (!record) {
      return null;
    }

    if (!args?.select) {
      return record;
    }

    const projected: Record<string, unknown> = {};
    for (const [field, enabled] of Object.entries(args.select)) {
      if (enabled) {
        projected[field] = (record as Record<string, unknown>)[field];
      }
    }

    return projected;
  };

  const findUnique = jest.fn(async (args: any) => {
    ensureAvailable();
    const key = args?.where?.key;
    return projectRecord(cloneRecord(store.get(key)), args);
  });

  const transaction = jest.fn(async (callback: (tx: any) => Promise<unknown>) => {
    ensureAvailable();

    const tx = {
      systemSetting: {
        findUnique: async (args: any) => {
          const key = args?.where?.key;
          return projectRecord(cloneRecord(store.get(key)), args);
        },
        upsert: async (args: any) => {
          const key = args?.where?.key;
          const existing = store.get(key);
          const now = new Date('2026-03-13T18:00:00.000Z');
          const nextRecord: StoredSettingRecord = existing
            ? {
                ...existing,
                valueJson: args.update.valueJson,
                valueType: args.update.valueType,
                category: args.update.category,
                scope: args.update.scope,
                tenantId: args.update.tenantId,
                source: args.update.source,
                updatedByUserId: args.update.updatedByUserId,
                version: existing.version + 1,
                updatedAt: now,
              }
            : {
                key,
                valueJson: args.create.valueJson,
                valueType: args.create.valueType,
                category: args.create.category,
                scope: args.create.scope,
                tenantId: args.create.tenantId,
                source: args.create.source,
                updatedByUserId: args.create.updatedByUserId,
                version: args.create.version,
                createdAt: now,
                updatedAt: now,
              };

          store.set(key, nextRecord);
          return projectRecord(cloneRecord(nextRecord), args);
        },
        delete: async (args: any) => {
          store.delete(args?.where?.key);
          return null;
        },
      },
      systemSettingAudit: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          audits.push(data);
          return data;
        },
      },
    };

    return callback(tx);
  });

  return {
    store,
    audits,
    systemSetting: {
      findUnique,
    },
    $transaction: transaction,
  };
};

describe('ModuleInstallerController dynamic settings integration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalModuleUpload = process.env.ENABLE_MODULE_UPLOAD;

  const createContext = (databaseAvailable = true) => {
    const prisma = createInMemoryPrisma(databaseAvailable);
    const registry = new SettingsRegistry();
    const resolver = new ConfigResolverService(registry, prisma as any);
    const writeService = new SystemSettingsWriteService(
      registry,
      resolver,
      prisma as any,
      new SystemSettingsAuditService(),
    );
    const installerMock = {
      installModuleFromZip: jest.fn().mockResolvedValue({ success: true }),
    };
    const controller = new ModuleInstallerController(installerMock as any, resolver);

    return {
      controller,
      installerMock,
      prisma,
      resolver,
      writeService,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_MODULE_UPLOAD;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalModuleUpload === undefined) {
      delete process.env.ENABLE_MODULE_UPLOAD;
    } else {
      process.env.ENABLE_MODULE_UPLOAD = originalModuleUpload;
    }
  });

  it('applies a panel override to the real module upload consumer and restores the default fallback', async () => {
    const { controller, installerMock, writeService } = createContext();

    await expect(controller.getCapabilities()).resolves.toEqual({
      environment: 'production',
      overrideEnabled: false,
      mutableModuleOpsAllowed: false,
      reason: 'blocked',
      message:
        'Upload/uninstall/reload de modulos desabilitado fora de development. Defina ENABLE_MODULE_UPLOAD=true ou use o painel para liberar explicitamente.',
    });

    await expect(controller.uploadModule(fileMock, requestMock as any)).rejects.toThrow(
      'Upload/uninstall/reload de modulos desabilitado fora de development. Defina ENABLE_MODULE_UPLOAD=true ou use o painel para liberar explicitamente.',
    );

    await writeService.updatePanelSetting(
      'security.module_upload.enabled',
      true,
      actor,
      'Liberar upload de modulos',
    );

    await expect(controller.getCapabilities()).resolves.toEqual({
      environment: 'production',
      overrideEnabled: true,
      mutableModuleOpsAllowed: true,
      reason: 'explicit_override',
      message: 'Operacoes mutaveis de modulos liberadas por override dinamico salvo no painel.',
    });

    await expect(controller.uploadModule(fileMock, requestMock as any)).resolves.toEqual({
      success: true,
    });
    expect(installerMock.installModuleFromZip).toHaveBeenCalledTimes(1);

    await writeService.restorePanelSettingFallback(
      'security.module_upload.enabled',
      actor,
      'Restaurar fallback',
    );

    await expect(controller.getCapabilities()).resolves.toEqual({
      environment: 'production',
      overrideEnabled: false,
      mutableModuleOpsAllowed: false,
      reason: 'blocked',
      message:
        'Upload/uninstall/reload de modulos desabilitado fora de development. Defina ENABLE_MODULE_UPLOAD=true ou use o painel para liberar explicitamente.',
    });
  });

  it('falls back to ENV when no override is present and restore returns to ENV beneath a database override', async () => {
    const { controller, installerMock, writeService } = createContext();
    process.env.ENABLE_MODULE_UPLOAD = 'true';

    await expect(controller.getCapabilities()).resolves.toEqual({
      environment: 'production',
      overrideEnabled: true,
      mutableModuleOpsAllowed: true,
      reason: 'explicit_override',
      message: 'Operacoes mutaveis de modulos liberadas por ENABLE_MODULE_UPLOAD=true.',
    });

    await writeService.updatePanelSetting(
      'security.module_upload.enabled',
      false,
      actor,
      'Bloquear upload pelo painel',
    );

    await expect(controller.uploadModule(fileMock, requestMock as any)).rejects.toThrow(
      'Upload/uninstall/reload de modulos desabilitado fora de development. Defina ENABLE_MODULE_UPLOAD=true ou use o painel para liberar explicitamente.',
    );

    await writeService.restorePanelSettingFallback(
      'security.module_upload.enabled',
      actor,
      'Voltar para ENV',
    );

    await expect(controller.uploadModule(fileMock, requestMock as any)).resolves.toEqual({
      success: true,
    });
    expect(installerMock.installModuleFromZip).toHaveBeenCalledTimes(1);
  });

  it('keeps fail-open behavior when the database is unavailable', async () => {
    const { controller, installerMock } = createContext(false);
    process.env.ENABLE_MODULE_UPLOAD = 'true';

    await expect(controller.getCapabilities()).resolves.toEqual({
      environment: 'production',
      overrideEnabled: true,
      mutableModuleOpsAllowed: true,
      reason: 'explicit_override',
      message: 'Operacoes mutaveis de modulos liberadas por ENABLE_MODULE_UPLOAD=true.',
    });

    await expect(controller.uploadModule(fileMock, requestMock as any)).resolves.toEqual({
      success: true,
    });
    expect(installerMock.installModuleFromZip).toHaveBeenCalledTimes(1);
  });
});
