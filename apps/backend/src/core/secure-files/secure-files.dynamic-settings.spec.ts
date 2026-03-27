import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SecureFilesService } from './secure-files.service';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { SettingsRegistry } from '../../system-settings/settings-registry.service';
import { SystemSettingsAuditService } from '../../system-settings/system-settings-audit.service';
import { SystemSettingsWriteService } from '../../system-settings/system-settings-write.service';
import { AuthorizationService } from '@common/services/authorization.service';

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
  secureFiles: Array<Record<string, unknown>>;
  systemSetting: {
    findUnique: jest.Mock<Promise<any>, [any]>;
  };
  module: {
    findUnique: jest.Mock<Promise<any>, [any]>;
  };
  moduleTenant: {
    findUnique: jest.Mock<Promise<any>, [any]>;
  };
  secureFile: {
    create: jest.Mock<Promise<any>, [any]>;
  };
  auditLog: {
    create: jest.Mock<Promise<any>, [any]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: any) => Promise<unknown>]>;
};

const actor = {
  userId: 'super-admin-1',
  email: 'super-admin@example.com',
};

const createInMemoryPrisma = (databaseAvailable = true): InMemoryPrisma => {
  const store = new Map<string, StoredSettingRecord>();
  const audits: Array<Record<string, unknown>> = [];
  const secureFiles: Array<Record<string, unknown>> = [];

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
          const now = new Date('2026-03-13T21:00:00.000Z');
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

  const moduleFindUnique = jest.fn(async (_args: any) => ({ id: 'module-1' }));
  const moduleTenantFindUnique = jest.fn(async (_args: any) => ({ enabled: true }));
  const secureFileCreate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const record = {
      id: data.id,
      tenantId: data.tenantId,
      moduleName: data.moduleName,
      documentType: data.documentType,
      originalName: data.originalName,
      storedName: data.storedName,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      uploadedBy: data.uploadedBy,
      metadata: data.metadata,
      uploadedAt: new Date('2026-03-13T21:15:00.000Z'),
    };
    secureFiles.push(record);
    return record;
  });
  const auditLogCreate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => data);

  return {
    store,
    audits,
    secureFiles,
    systemSetting: {
      findUnique,
    },
    module: {
      findUnique: moduleFindUnique,
    },
    moduleTenant: {
      findUnique: moduleTenantFindUnique,
    },
    secureFile: {
      create: secureFileCreate,
    },
    auditLog: {
      create: auditLogCreate,
    },
    $transaction: transaction,
  };
};

describe('SecureFilesService dynamic file signature validation', () => {
  const originalSignatureValidation = process.env.ENABLE_FILE_SIGNATURE_VALIDATION;

  let tempRoot: string;

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
    const uploadsDir = path.join(tempRoot, 'uploads');
    const tempDir = path.join(uploadsDir, 'temp');
    const secureDir = path.join(uploadsDir, 'secure');
    const ensureDir = (dirPath: string) => {
      fs.mkdirSync(dirPath, { recursive: true });
      return dirPath;
    };
    const pathsServiceMock = {
      ensureDir: jest.fn(ensureDir),
      getUploadsDir: jest.fn(() => uploadsDir),
      getTempDir: jest.fn(() => tempDir),
      getSecureDir: jest.fn(() => secureDir),
    };
    const service = new SecureFilesService(
      prisma as any,
      pathsServiceMock as any,
      resolver,
      new AuthorizationService(),
    );

    return {
      prisma,
      resolver,
      writeService,
      service,
      pathsServiceMock,
      tempDir,
      secureDir,
    };
  };

  const createTempFile = (tempDir: string, fileName: string, buffer: Buffer, mimetype = 'image/png') => {
    fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, buffer);

    return {
      path: filePath,
      originalname: fileName,
      mimetype,
      size: buffer.length,
      filename: fileName,
    } as Express.Multer.File;
  };

  const findStoredFile = (secureDir: string, tenantId: string, moduleName: string, documentType: string) => {
    const targetDir = path.join(secureDir, 'tenants', tenantId, 'modules', moduleName, documentType);
    if (!fs.existsSync(targetDir)) {
      return [];
    }

    return fs.readdirSync(targetDir);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'secure-files-dynamic-setting-'));
    delete process.env.ENABLE_FILE_SIGNATURE_VALIDATION;
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  afterAll(() => {
    if (originalSignatureValidation === undefined) {
      delete process.env.ENABLE_FILE_SIGNATURE_VALIDATION;
    } else {
      process.env.ENABLE_FILE_SIGNATURE_VALIDATION = originalSignatureValidation;
    }
  });

  it('uses the default setting when there is no override and rejects invalid signatures', async () => {
    const { service, tempDir } = createContext();
    const file = createTempFile(tempDir, 'evidence.png', Buffer.alloc(128, 0x41));

    await expect(
      service.uploadFile(file, 'tenant-1', 'clientes', 'contrato', 'user-1'),
    ).rejects.toThrow('Invalid file signature');
    expect(fs.existsSync(file.path)).toBe(false);
  });

  it('falls back to ENV when no database override exists and allows the upload', async () => {
    const { service, tempDir, secureDir, prisma } = createContext();
    process.env.ENABLE_FILE_SIGNATURE_VALIDATION = 'false';
    const file = createTempFile(tempDir, 'env-disabled.png', Buffer.alloc(128, 0x41));

    await expect(
      service.uploadFile(file, 'tenant-1', 'clientes', 'contrato', 'user-1'),
    ).resolves.toMatchObject({
      originalName: 'env-disabled.png',
      moduleName: 'clientes',
      documentType: 'contrato',
    });
    expect(prisma.secureFile.create).toHaveBeenCalledTimes(1);
    expect(findStoredFile(secureDir, 'tenant-1', 'clientes', 'contrato')).toHaveLength(1);
  });

  it('applies a database override and restore fallback without changing the tiny-file guard', async () => {
    const { service, tempDir, writeService, secureDir, prisma } = createContext();

    await writeService.updatePanelSetting(
      'security.file_signature_validation.enabled',
      false,
      actor,
      'Disable magic number validation',
    );

    const bypassedFile = createTempFile(tempDir, 'panel-disabled.png', Buffer.alloc(128, 0x41));
    await expect(
      service.uploadFile(bypassedFile, 'tenant-1', 'clientes', 'contrato', 'user-1'),
    ).resolves.toMatchObject({
      originalName: 'panel-disabled.png',
    });
    expect(prisma.secureFile.create).toHaveBeenCalledTimes(1);
    expect(findStoredFile(secureDir, 'tenant-1', 'clientes', 'contrato')).toHaveLength(1);

    const tinyFile = createTempFile(tempDir, 'tiny.png', Buffer.alloc(16, 0x41));
    await expect(
      service.uploadFile(tinyFile, 'tenant-1', 'clientes', 'contrato', 'user-1'),
    ).rejects.toThrow('File is too small or corrupted');

    await writeService.restorePanelSettingFallback(
      'security.file_signature_validation.enabled',
      actor,
      'Restore fallback',
    );

    const restoredFile = createTempFile(tempDir, 'restored.png', Buffer.alloc(128, 0x41));
    await expect(
      service.uploadFile(restoredFile, 'tenant-1', 'clientes', 'contrato', 'user-1'),
    ).rejects.toThrow('Invalid file signature');
  });

  it('keeps fail-open behavior when the database is unavailable by using ENV fallback', async () => {
    const { service, tempDir, secureDir, prisma } = createContext(false);
    process.env.ENABLE_FILE_SIGNATURE_VALIDATION = 'false';
    const file = createTempFile(tempDir, 'fail-open.png', Buffer.alloc(128, 0x41));

    await expect(
      service.uploadFile(file, 'tenant-1', 'clientes', 'contrato', 'user-1'),
    ).resolves.toMatchObject({
      originalName: 'fail-open.png',
    });
    expect(prisma.secureFile.create).toHaveBeenCalledTimes(1);
    expect(findStoredFile(secureDir, 'tenant-1', 'clientes', 'contrato')).toHaveLength(1);
  });
});
