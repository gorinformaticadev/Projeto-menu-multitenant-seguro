import { AuditService } from '../../audit/audit.service';
import { CronService } from '../../core/cron/cron.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationGateway } from '../../notifications/notification.gateway';
import { NotificationService } from '../../notifications/notification.service';
import { PushNotificationService } from '../../notifications/push-notification.service';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { SettingsRegistry } from '../../system-settings/settings-registry.service';
import { SystemSettingsAuditService } from '../../system-settings/system-settings-audit.service';
import { SystemSettingsWriteService } from '../../system-settings/system-settings-write.service';
import { SystemTelemetryService } from './system-telemetry.service';
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
  backupJob: {
    findMany: jest.Mock<Promise<any[]>, [any?]>;
  };
  $queryRaw: jest.Mock<Promise<any[]>, [any?]>;
  $executeRaw: jest.Mock<Promise<unknown>, [any?]>;
  $transaction: jest.Mock<Promise<unknown>, [(tx: any) => Promise<unknown>]>;
};

const actor = {
  userId: 'super-admin-1',
  email: 'super-admin@example.com',
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
          const now = new Date('2026-03-13T23:10:00.000Z');
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
    backupJob: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ acquired: true }]),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    $transaction: transaction,
  };
};

describe('SystemOperationalAlertsService dynamic operations alerts toggle', () => {
  const originalEnvValue = process.env.OPS_ALERTS_ENABLED;

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
    const notificationService = {
      createSystemNotificationEntity: jest.fn().mockResolvedValue({
        id: 'notification-1',
        title: 'Alerta operacional',
      }),
    };
    const notificationGateway = {
      emitNewNotification: jest.fn().mockResolvedValue(undefined),
    };
    const pushNotificationService = {
      getPublicKey: jest.fn().mockResolvedValue('public-key'),
    };
    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    const cronService = {
      register: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SystemOperationalAlertsService(
      prisma as unknown as PrismaService,
      new SystemTelemetryService(),
      notificationService as unknown as NotificationService,
      notificationGateway as unknown as NotificationGateway,
      pushNotificationService as unknown as PushNotificationService,
      auditService as unknown as AuditService,
      cronService as unknown as CronService,
      resolver,
    );

    return {
      prisma,
      resolver,
      writeService,
      notificationService,
      notificationGateway,
      pushNotificationService,
      auditService,
      cronService,
      service,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPS_ALERTS_ENABLED;
  });

  afterAll(() => {
    if (originalEnvValue === undefined) {
      delete process.env.OPS_ALERTS_ENABLED;
    } else {
      process.env.OPS_ALERTS_ENABLED = originalEnvValue;
    }
  });

  const dispatchInput = {
    action: 'OPS_MANUAL_TEST',
    cooldownKey: 'OPS_MANUAL_TEST',
    severity: 'critical' as const,
    title: 'Teste manual',
    body: 'Alerta operacional manual',
    pushEligible: true,
    audit: true,
    source: 'operational-alerts',
  };

  it('uses the default setting to generate operational alerts', async () => {
    const { service, notificationService, notificationGateway, pushNotificationService, auditService } =
      createContext();

    await expect(service.dispatchOperationalAlert(dispatchInput, Date.now(), 15)).resolves.toBe(true);

    expect(notificationService.createSystemNotificationEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Teste manual',
        module: 'operational-alerts',
        source: 'operational-alerts',
      }),
    );
    expect(pushNotificationService.getPublicKey).toHaveBeenCalledTimes(1);
    expect(notificationGateway.emitNewNotification).toHaveBeenCalledTimes(1);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'OPS_MANUAL_TEST',
        severity: 'critical',
      }),
    );
  });

  it('falls back to ENV when no database override exists', async () => {
    process.env.OPS_ALERTS_ENABLED = 'false';
    const { service, notificationService, notificationGateway, pushNotificationService, auditService } =
      createContext();

    await expect(service.dispatchOperationalAlert(dispatchInput, Date.now(), 15)).resolves.toBe(false);

    expect(notificationService.createSystemNotificationEntity).not.toHaveBeenCalled();
    expect(pushNotificationService.getPublicKey).not.toHaveBeenCalled();
    expect(notificationGateway.emitNewNotification).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('applies a database override and restores the env fallback', async () => {
    process.env.OPS_ALERTS_ENABLED = 'false';
    const { service, notificationService, notificationGateway, writeService } = createContext();

    await writeService.updatePanelSetting(
      'operations.alerts.enabled',
      true,
      actor,
      'Enable operational alerts override',
    );

    await expect(service.dispatchOperationalAlert(dispatchInput, Date.now(), 15)).resolves.toBe(true);
    expect(notificationService.createSystemNotificationEntity).toHaveBeenCalledTimes(1);
    expect(notificationGateway.emitNewNotification).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();

    await writeService.restorePanelSettingFallback(
      'operations.alerts.enabled',
      actor,
      'Restore env fallback',
    );

    await expect(service.dispatchOperationalAlert(dispatchInput, Date.now(), 15)).resolves.toBe(false);
    expect(notificationService.createSystemNotificationEntity).not.toHaveBeenCalled();
    expect(notificationGateway.emitNewNotification).not.toHaveBeenCalled();
  });

  it('keeps fail-open behavior when the dynamic settings store is unavailable', async () => {
    const defaultContext = createContext(false);

    await expect(defaultContext.service.dispatchOperationalAlert(dispatchInput, Date.now(), 15)).resolves.toBe(
      true,
    );
    expect(defaultContext.notificationService.createSystemNotificationEntity).toHaveBeenCalledTimes(1);

    process.env.OPS_ALERTS_ENABLED = 'false';
    const envContext = createContext(false);

    await expect(envContext.service.dispatchOperationalAlert(dispatchInput, Date.now(), 15)).resolves.toBe(
      false,
    );
    expect(envContext.notificationService.createSystemNotificationEntity).not.toHaveBeenCalled();
    expect(envContext.notificationGateway.emitNewNotification).not.toHaveBeenCalled();
  });
});
