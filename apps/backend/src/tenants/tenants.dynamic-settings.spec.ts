import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { resolveTenantLogoFilePath } from '@core/common/paths/paths.service';
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
          const now = new Date('2026-03-13T20:00:00.000Z');
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

describe('TenantsController dynamic file signature validation', () => {
  const originalUploadsDir = process.env.UPLOADS_DIR;
  const originalLogoDir = process.env.LOGOS_UPLOAD_DIR;
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
    const tenantsServiceMock = {
      updateLogo: jest.fn().mockImplementation(async (tenantId: string, filename: string) => ({
        id: tenantId,
        logoUrl: filename,
      })),
    };
    const controller = new TenantsController(
      tenantsServiceMock as any,
      {} as any,
      resolver,
    );

    return {
      controller,
      prisma,
      resolver,
      writeService,
      tenantsServiceMock,
    };
  };

  const writeLogoFile = (tenantId: string, fileName: string, buffer: Buffer) => {
    const filePath = resolveTenantLogoFilePath(tenantId, fileName);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  };

  const createUploadFile = (fileName: string, mimetype: string): Express.Multer.File =>
    ({
      filename: fileName,
      mimetype,
      originalname: fileName,
    }) as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tenant-logo-dynamic-setting-'));
    process.env.UPLOADS_DIR = tempRoot;
    delete process.env.LOGOS_UPLOAD_DIR;
    delete process.env.ENABLE_FILE_SIGNATURE_VALIDATION;
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  afterAll(() => {
    if (originalUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = originalUploadsDir;
    }

    if (originalLogoDir === undefined) {
      delete process.env.LOGOS_UPLOAD_DIR;
    } else {
      process.env.LOGOS_UPLOAD_DIR = originalLogoDir;
    }

    if (originalSignatureValidation === undefined) {
      delete process.env.ENABLE_FILE_SIGNATURE_VALIDATION;
    } else {
      process.env.ENABLE_FILE_SIGNATURE_VALIDATION = originalSignatureValidation;
    }
  });

  it('uses the default setting when there is no override and rejects invalid signatures', async () => {
    const { controller, tenantsServiceMock } = createContext();
    const file = createUploadFile('logo.png', 'image/png');
    const invalidBuffer = Buffer.alloc(128, 0x41);
    const filePath = writeLogoFile('tenant-1', file.filename, invalidBuffer);

    await expect(controller.uploadLogo('tenant-1', file)).rejects.toBeInstanceOf(BadRequestException);
    expect(tenantsServiceMock.updateLogo).not.toHaveBeenCalled();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('falls back to ENV when no database override exists and allows the upload', async () => {
    const { controller, tenantsServiceMock } = createContext();
    process.env.ENABLE_FILE_SIGNATURE_VALIDATION = 'false';
    const file = createUploadFile('logo-env.png', 'image/png');
    writeLogoFile('tenant-1', file.filename, Buffer.alloc(128, 0x41));

    await expect(controller.uploadLogo('tenant-1', file)).resolves.toEqual({
      id: 'tenant-1',
      logoUrl: 'logo-env.png',
    });
    expect(tenantsServiceMock.updateLogo).toHaveBeenCalledWith('tenant-1', 'logo-env.png');
  });

  it('applies a database override and restore fallback without changing the tiny-file guard', async () => {
    const { controller, writeService, tenantsServiceMock } = createContext();
    const file = createUploadFile('logo-panel.png', 'image/png');

    await writeService.updatePanelSetting(
      'security.file_signature_validation.enabled',
      false,
      actor,
      'Disable magic number validation',
    );

    writeLogoFile('tenant-1', file.filename, Buffer.alloc(128, 0x41));
    await expect(controller.uploadLogo('tenant-1', file)).resolves.toEqual({
      id: 'tenant-1',
      logoUrl: 'logo-panel.png',
    });
    expect(tenantsServiceMock.updateLogo).toHaveBeenCalledTimes(1);

    const tinyFile = createUploadFile('logo-small.png', 'image/png');
    const tinyPath = writeLogoFile('tenant-1', tinyFile.filename, Buffer.alloc(16, 0x41));
    await expect(controller.uploadLogo('tenant-1', tinyFile)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fs.existsSync(tinyPath)).toBe(false);

    await writeService.restorePanelSettingFallback(
      'security.file_signature_validation.enabled',
      actor,
      'Restore fallback',
    );

    writeLogoFile('tenant-1', file.filename, Buffer.alloc(128, 0x41));
    await expect(controller.uploadLogo('tenant-1', file)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps fail-open behavior when the database is unavailable by using ENV fallback', async () => {
    const { controller, tenantsServiceMock } = createContext(false);
    process.env.ENABLE_FILE_SIGNATURE_VALIDATION = 'false';
    const file = createUploadFile('logo-fail-open.png', 'image/png');
    writeLogoFile('tenant-1', file.filename, Buffer.alloc(128, 0x41));

    await expect(controller.uploadLogo('tenant-1', file)).resolves.toEqual({
      id: 'tenant-1',
      logoUrl: 'logo-fail-open.png',
    });
    expect(tenantsServiceMock.updateLogo).toHaveBeenCalledWith('tenant-1', 'logo-fail-open.png');
  });
});
