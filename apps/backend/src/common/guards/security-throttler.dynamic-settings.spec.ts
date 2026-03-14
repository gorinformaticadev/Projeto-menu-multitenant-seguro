import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { SettingsRegistry } from '../../system-settings/settings-registry.service';
import { SystemSettingsAuditService } from '../../system-settings/system-settings-audit.service';
import { SystemSettingsWriteService } from '../../system-settings/system-settings-write.service';
import { SecurityThrottlerGuard } from './security-throttler.guard';

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

const applyDatabaseOverride = (
  prisma: InMemoryPrisma,
  key: string,
  value: boolean,
  updatedByUserId = actor.userId,
) => {
  const now = new Date('2026-03-14T12:00:00.000Z');
  const existing = prisma.store.get(key);
  prisma.store.set(key, {
    key,
    valueJson: value,
    valueType: 'boolean',
    category: 'security',
    scope: 'system',
    tenantId: null,
    source: 'panel',
    updatedByUserId,
    version: existing ? existing.version + 1 : 1,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
};

const restoreDatabaseFallback = (prisma: InMemoryPrisma, key: string) => {
  prisma.store.delete(key);
};

const createInMemoryPrisma = (settingsDatabaseAvailable = true): InMemoryPrisma => {
  const store = new Map<string, StoredSettingRecord>();
  const audits: Array<Record<string, unknown>> = [];

  const ensureSettingsAvailable = () => {
    if (!settingsDatabaseAvailable) {
      throw new Error('dynamic settings db offline');
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

  const systemSettingFindUnique = jest.fn(async (args: any) => {
    ensureSettingsAvailable();
    return projectRecord(cloneRecord(store.get(args?.where?.key)), args);
  });

  const transaction = jest.fn(async (callback: (tx: any) => Promise<unknown>) => {
    ensureSettingsAvailable();

    const tx = {
      systemSetting: {
        findUnique: async (args: any) => {
          return projectRecord(cloneRecord(store.get(args?.where?.key)), args);
        },
        upsert: async (args: any) => {
          const key = args?.where?.key;
          const existing = store.get(key);
          const now = new Date('2026-03-14T12:00:00.000Z');
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
      findUnique: systemSettingFindUnique,
    },
    $transaction: transaction,
  };
};

const createHttpContext = (path = '/api/orders', ip = '10.0.0.10') => {
  const req = {
    originalUrl: path,
    url: path,
    path,
    method: 'GET',
    ip,
    headers: {
      'user-agent': 'jest',
    },
  };

  const resHeaders: Record<string, string | number> = {};
  const res = {
    header: jest.fn((name: string, value: string | number) => {
      resHeaders[name] = value;
      return res;
    }),
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    getClass: () => ({ name: 'OrdersController' }),
    getHandler: () => ({ name: 'list' }),
  };

  return { context, req, res, resHeaders };
};

const createRequestProps = (
  context: any,
  options?: {
    limit?: number;
    ttl?: number;
    moduleLimit?: number;
    moduleTtl?: number;
  },
) => {
  const ttl = options?.ttl ?? 60000;
  const limit = options?.limit ?? 3;
  const moduleLimit = options?.moduleLimit ?? 3;
  const moduleTtl = options?.moduleTtl ?? 60000;

  return {
    context,
    limit,
    ttl,
    blockDuration: ttl,
    throttler: {
      name: 'default',
      limit: moduleLimit,
      ttl: moduleTtl,
    },
    getTracker: async (req: Record<string, any>) => `ip:${req.ip}`,
    generateKey: (_context: any, tracker: string, name: string) => `${name}:${tracker}`,
  };
};

const invokeGuard = async (
  guard: SecurityThrottlerGuard,
  context: any,
  options?: {
    limit?: number;
    ttl?: number;
    moduleLimit?: number;
    moduleTtl?: number;
  },
) => {
  return (guard as any).handleRequest(createRequestProps(context, options));
};

describe('SecurityThrottlerGuard dynamic global rate limit toggle', () => {
  const originalEnvValue = process.env.RATE_LIMITING_ENABLED;

  const createContext = async (prisma = createInMemoryPrisma(true)) => {
    const registry = new SettingsRegistry();
    const resolver = new ConfigResolverService(registry, prisma as any);
    const writeService = new SystemSettingsWriteService(
      registry,
      resolver,
      prisma as any,
      new SystemSettingsAuditService(),
    );
    const securityConfigService = {
      getRateLimitConfig: jest.fn().mockResolvedValue({
        enabled: true,
        requests: 1,
        window: 1,
        isProduction: false,
      }),
    };
    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    const rateLimitMetricsService = {
      record: jest.fn().mockResolvedValue(undefined),
      shouldEmitBlockedAudit: jest.fn().mockResolvedValue(true),
    };
    const systemTelemetryService = {
      recordSecurityEvent: jest.fn(),
    };
    const storage = new ThrottlerStorageService();
    const guard = new SecurityThrottlerGuard(
      [{ name: 'default', ttl: 60000, limit: 3 }] as any,
      storage,
      new Reflector(),
      securityConfigService as any,
      auditService as any,
      rateLimitMetricsService as any,
      systemTelemetryService as any,
      resolver,
    );

    await guard.onModuleInit();

    return {
      prisma,
      resolver,
      writeService,
      securityConfigService,
      auditService,
      rateLimitMetricsService,
      systemTelemetryService,
      guard,
      storage,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.RATE_LIMITING_ENABLED;
  });

  afterAll(() => {
    if (originalEnvValue === undefined) {
      delete process.env.RATE_LIMITING_ENABLED;
    } else {
      process.env.RATE_LIMITING_ENABLED = originalEnvValue;
    }
  });

  it('uses the default setting to keep the global rate limit active', async () => {
    const { guard, auditService, rateLimitMetricsService } = await createContext();
    const http = createHttpContext();

    await expect(invokeGuard(guard, http.context)).resolves.toBe(true);
    await expect(invokeGuard(guard, http.context)).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
      }),
    });

    expect(rateLimitMetricsService.record).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RATE_LIMIT_BLOCKED',
      }),
    );
  });

  it('falls back to ENV when no database override exists', async () => {
    process.env.RATE_LIMITING_ENABLED = 'false';
    const { guard } = await createContext();
    const http = createHttpContext('/api/orders', '10.0.0.20');

    await expect(invokeGuard(guard, http.context)).resolves.toBe(true);
    await expect(invokeGuard(guard, http.context)).resolves.toBe(true);
  });

  it('applies a database override and restores the env fallback', async () => {
    process.env.RATE_LIMITING_ENABLED = 'false';
    const prisma = createInMemoryPrisma(true);
    const initialContext = await createContext(prisma);

    applyDatabaseOverride(prisma, 'security.rate_limit.enabled', true);

    const enabledContext = await createContext(prisma);
    const enabledHttp = createHttpContext('/api/orders', '10.0.0.30');
    await expect(invokeGuard(enabledContext.guard, enabledHttp.context)).resolves.toBe(true);
    await expect(invokeGuard(enabledContext.guard, enabledHttp.context)).rejects.toBeInstanceOf(
      HttpException,
    );

    restoreDatabaseFallback(prisma, 'security.rate_limit.enabled');

    const restoredContext = await createContext(prisma);
    const restoredHttp = createHttpContext('/api/orders', '10.0.0.31');
    await expect(invokeGuard(restoredContext.guard, restoredHttp.context)).resolves.toBe(true);
    await expect(invokeGuard(restoredContext.guard, restoredHttp.context)).resolves.toBe(true);
  });

  it('keeps fail-open behavior when the dynamic settings store is unavailable', async () => {
    const defaultContext = await createContext(createInMemoryPrisma(false));
    const defaultHttp = createHttpContext('/api/orders', '10.0.0.40');

    await expect(invokeGuard(defaultContext.guard, defaultHttp.context)).resolves.toBe(true);
    await expect(invokeGuard(defaultContext.guard, defaultHttp.context)).rejects.toBeInstanceOf(
      HttpException,
    );

    process.env.RATE_LIMITING_ENABLED = 'false';
    const envContext = await createContext(createInMemoryPrisma(false));
    const envHttp = createHttpContext('/api/orders', '10.0.0.41');

    await expect(invokeGuard(envContext.guard, envHttp.context)).resolves.toBe(true);
    await expect(invokeGuard(envContext.guard, envHttp.context)).resolves.toBe(true);
  });

  it('keeps explicit per-route throttles active when the global toggle is disabled', async () => {
    process.env.RATE_LIMITING_ENABLED = 'false';
    const { guard } = await createContext();
    const http = createHttpContext('/api/auth/login', '10.0.0.50');

    await expect(
      invokeGuard(guard, http.context, {
        limit: 1,
        ttl: 60000,
        moduleLimit: 3,
        moduleTtl: 60000,
      }),
    ).resolves.toBe(true);
    await expect(
      invokeGuard(guard, http.context, {
        limit: 1,
        ttl: 60000,
        moduleLimit: 3,
        moduleTtl: 60000,
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
