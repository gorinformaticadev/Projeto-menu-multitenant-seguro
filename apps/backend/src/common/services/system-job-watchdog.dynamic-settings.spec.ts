import { CronService } from '../../core/cron/cron.service';
import { CronJobHeartbeatService } from '../../core/cron/cron-job-heartbeat.service';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { SettingsRegistry } from '../../system-settings/settings-registry.service';
import { SystemSettingsAuditService } from '../../system-settings/system-settings-audit.service';
import { SystemSettingsWriteService } from '../../system-settings/system-settings-write.service';
import { RedisLockService } from './redis-lock.service';
import { SessionCleanupExecutionService } from './session-cleanup-execution.service';
import { SystemJobWatchdogService } from './system-job-watchdog.service';
import { SystemOperationalAlertsService } from './system-operational-alerts.service';

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

const staleJob = {
  key: 'system.update_check',
  name: 'Update check',
  description: 'Checks for updates',
  schedule: '0 * * * *',
  enabled: true,
  runtimeRegistered: true,
  runtimeActive: true,
  lastStatus: 'success',
  lastStartedAt: new Date('2026-03-07T12:00:00.000Z'),
  lastSucceededAt: new Date('2026-03-07T12:01:00.000Z'),
  nextExpectedRunAt: new Date('2026-03-07T13:00:00.000Z'),
  consecutiveFailureCount: 0,
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
          const now = new Date('2026-03-14T10:00:00.000Z');
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

describe('SystemJobWatchdogService dynamic watchdog toggle', () => {
  const originalEnvValue = process.env.OPS_WATCHDOG_ENABLED;

  const createContext = (settingsDatabaseAvailable = true) => {
    const prisma = createInMemoryPrisma(settingsDatabaseAvailable);
    const registry = new SettingsRegistry();
    const resolver = new ConfigResolverService(registry, prisma as any);
    const writeService = new SystemSettingsWriteService(
      registry,
      resolver,
      prisma as any,
      new SystemSettingsAuditService(),
    );
    const cronService = {
      register: jest.fn().mockResolvedValue(undefined),
      getRuntimeJobs: jest.fn().mockResolvedValue([staleJob]),
      isMaintenancePaused: jest.fn().mockReturnValue(false),
    };
    const heartbeatService = {
      reconcileOrphans: jest.fn().mockResolvedValue(undefined),
    };
    const operationalAlertsService = {
      dispatchOperationalAlert: jest.fn().mockResolvedValue(true),
    };
    const redisLock = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
      isDegraded: jest.fn().mockReturnValue(false),
    };
    const sessionCleanupExecutionService = {
      inspectExpectedExecution: jest.fn(),
      inspectLatestExecution: jest.fn(),
      inspectExecutionById: jest.fn(),
      listRunningExecutions: jest.fn().mockResolvedValue([]),
    };
    const service = new SystemJobWatchdogService(
      cronService as unknown as CronService,
      heartbeatService as unknown as CronJobHeartbeatService,
      operationalAlertsService as unknown as SystemOperationalAlertsService,
      resolver,
      redisLock as unknown as RedisLockService,
      sessionCleanupExecutionService as unknown as SessionCleanupExecutionService,
    );

    return {
      prisma,
      resolver,
      writeService,
      cronService,
      heartbeatService,
      operationalAlertsService,
      redisLock,
      sessionCleanupExecutionService,
      service,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPS_WATCHDOG_ENABLED;
  });

  afterAll(() => {
    if (originalEnvValue === undefined) {
      delete process.env.OPS_WATCHDOG_ENABLED;
    } else {
      process.env.OPS_WATCHDOG_ENABLED = originalEnvValue;
    }
  });

  it('uses the default setting to keep the watchdog running', async () => {
    const { service, cronService, operationalAlertsService } = createContext();

    await expect(service.evaluateWatchdog(new Date('2026-03-07T15:01:00.000Z'))).resolves.toEqual({
      emitted: ['JOB_NOT_RUNNING:system.update_check'],
      skipped: [],
    });

    expect(cronService.getRuntimeJobs).toHaveBeenCalledTimes(1);
    expect(operationalAlertsService.dispatchOperationalAlert).toHaveBeenCalledTimes(1);
  });

  it('falls back to ENV when no database override exists', async () => {
    process.env.OPS_WATCHDOG_ENABLED = 'false';
    const { service, cronService, operationalAlertsService } = createContext();

    await expect(service.evaluateWatchdog(new Date('2026-03-07T15:00:00.000Z'))).resolves.toEqual({
      emitted: [],
      skipped: ['watchdog_disabled'],
    });

    expect(cronService.getRuntimeJobs).not.toHaveBeenCalled();
    expect(operationalAlertsService.dispatchOperationalAlert).not.toHaveBeenCalled();
  });

  it('applies a database override and restores the env fallback', async () => {
    process.env.OPS_WATCHDOG_ENABLED = 'false';
    const { service, writeService, cronService, operationalAlertsService } = createContext();

    await writeService.updatePanelSetting(
      'operations.watchdog.enabled',
      true,
      actor,
      'Enable watchdog override',
    );

    await expect(service.evaluateWatchdog(new Date('2026-03-07T15:01:00.000Z'))).resolves.toEqual({
      emitted: ['JOB_NOT_RUNNING:system.update_check'],
      skipped: [],
    });
    expect(cronService.getRuntimeJobs).toHaveBeenCalledTimes(1);
    expect(operationalAlertsService.dispatchOperationalAlert).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();

    await writeService.restorePanelSettingFallback(
      'operations.watchdog.enabled',
      actor,
      'Restore env fallback',
    );

    await expect(service.evaluateWatchdog(new Date('2026-03-07T15:00:00.000Z'))).resolves.toEqual({
      emitted: [],
      skipped: ['watchdog_disabled'],
    });
    expect(cronService.getRuntimeJobs).not.toHaveBeenCalled();
    expect(operationalAlertsService.dispatchOperationalAlert).not.toHaveBeenCalled();
  });

  it('keeps fail-open behavior when the dynamic settings store is unavailable', async () => {
    const defaultContext = createContext(false);

    await expect(
      defaultContext.service.evaluateWatchdog(new Date('2026-03-07T15:01:00.000Z')),
    ).resolves.toEqual({
      emitted: ['JOB_NOT_RUNNING:system.update_check'],
      skipped: [],
    });
    expect(defaultContext.cronService.getRuntimeJobs).toHaveBeenCalledTimes(1);

    process.env.OPS_WATCHDOG_ENABLED = 'false';
    const envContext = createContext(false);

    await expect(envContext.service.evaluateWatchdog(new Date('2026-03-07T15:00:00.000Z'))).resolves.toEqual({
      emitted: [],
      skipped: ['watchdog_disabled'],
    });
    expect(envContext.cronService.getRuntimeJobs).not.toHaveBeenCalled();
    expect(envContext.operationalAlertsService.dispatchOperationalAlert).not.toHaveBeenCalled();
  });
});
