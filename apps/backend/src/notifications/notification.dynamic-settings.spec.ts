import { NotificationsController } from './notifications.controller';
import { NotificationService } from './notification.service';
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

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  message: string;
  severity: string;
  audience: string;
  source: string | null;
  module: string | null;
  tenantId: string | null;
  userId: string | null;
  targetRole: string | null;
  targetUserId: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type UserRow = {
  id: string;
  role: string;
  tenantId: string | null;
};

type InMemoryPrisma = {
  store: Map<string, StoredSettingRecord>;
  audits: Array<Record<string, unknown>>;
  notifications: NotificationRow[];
  users: UserRow[];
  systemSetting: {
    findUnique: jest.Mock<Promise<any>, [any]>;
  };
  notification: {
    create: jest.Mock<Promise<any>, [any]>;
    createMany: jest.Mock<Promise<any>, [any]>;
    findMany: jest.Mock<Promise<any>, [any?]>;
    count: jest.Mock<Promise<any>, [any?]>;
  };
  user: {
    findMany: jest.Mock<Promise<any>, [any?]>;
    findFirst: jest.Mock<Promise<any>, [any]>;
    findUnique: jest.Mock<Promise<any>, [any]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: any) => Promise<unknown>]>;
};

const actor = {
  userId: 'super-admin-1',
  email: 'super-admin@example.com',
};

const requestUser = {
  id: 'super-admin-1',
  role: 'SUPER_ADMIN',
  tenantId: null,
};

const createNotificationDto = {
  title: 'Modulo atualizado',
  description: 'Uma alteracao foi aplicada ao sistema.',
  type: 'info' as const,
};

const createInMemoryPrisma = (settingsDatabaseAvailable = true): InMemoryPrisma => {
  const store = new Map<string, StoredSettingRecord>();
  const audits: Array<Record<string, unknown>> = [];
  const notifications: NotificationRow[] = [];
  const users: UserRow[] = [
    { id: 'admin-1', role: 'ADMIN', tenantId: 'tenant-1' },
    { id: 'admin-2', role: 'ADMIN', tenantId: 'tenant-2' },
    { id: 'super-admin-1', role: 'SUPER_ADMIN', tenantId: null },
  ];

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

  const matchWhere = (record: Record<string, any>, where?: Record<string, any>): boolean => {
    if (!where) {
      return true;
    }

    return Object.entries(where).every(([field, value]) => {
      if (field === 'OR' && Array.isArray(value)) {
        return value.some((entry) => matchWhere(record, entry));
      }

      if (field === 'AND' && Array.isArray(value)) {
        return value.every((entry) => matchWhere(record, entry));
      }

      if (value && typeof value === 'object' && 'in' in value) {
        return Array.isArray((value as { in: unknown[] }).in)
          ? (value as { in: unknown[] }).in.includes(record[field])
          : false;
      }

      if (value && typeof value === 'object' && ('gte' in value || 'lte' in value)) {
        const current = record[field] instanceof Date ? record[field].getTime() : new Date(record[field]).getTime();
        const gte = 'gte' in value && value.gte ? new Date(value.gte as Date).getTime() : Number.NEGATIVE_INFINITY;
        const lte = 'lte' in value && value.lte ? new Date(value.lte as Date).getTime() : Number.POSITIVE_INFINITY;
        return current >= gte && current <= lte;
      }

      return record[field] === value;
    });
  };

  const normalizeNotification = (data: Record<string, any>): NotificationRow => {
    const now = new Date(`2026-03-13T22:${String(notifications.length).padStart(2, '0')}:00.000Z`);
    return {
      id: typeof data.id === 'string' ? data.id : `notification-${notifications.length + 1}`,
      type: String(data.type || 'SYSTEM_ALERT'),
      title: String(data.title || ''),
      body: String(data.body ?? data.message ?? ''),
      message: String(data.message ?? data.body ?? ''),
      severity: String(data.severity || 'info'),
      audience: String(data.audience || 'super_admin'),
      source: typeof data.source === 'string' ? data.source : null,
      module: typeof data.module === 'string' ? data.module : null,
      tenantId: typeof data.tenantId === 'string' ? data.tenantId : null,
      userId: typeof data.userId === 'string' ? data.userId : null,
      targetRole: typeof data.targetRole === 'string' ? data.targetRole : null,
      targetUserId: typeof data.targetUserId === 'string' ? data.targetUserId : null,
      data: (data.data || {}) as Record<string, unknown>,
      isRead: Boolean(data.isRead ?? false),
      read: Boolean(data.read ?? false),
      readAt: data.readAt instanceof Date ? data.readAt : data.readAt ? new Date(data.readAt) : null,
      createdAt: data.createdAt instanceof Date ? data.createdAt : now,
      updatedAt: data.updatedAt instanceof Date ? data.updatedAt : now,
    };
  };

  const systemSettingFindUnique = jest.fn(async (args: any) => {
    ensureSettingsAvailable();
    return projectRecord(cloneRecord(store.get(args?.where?.key)), args);
  });

  const notificationCreate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const record = normalizeNotification(data);
    notifications.push(record);
    return record;
  });

  const notificationCreateMany = jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
    for (const entry of data) {
      notifications.push(normalizeNotification(entry));
    }

    return { count: data.length };
  });

  const notificationFindMany = jest.fn(async (args: any = {}) => {
    const filtered = notifications
      .filter((record) => matchWhere(record, args.where))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    const skip = Number(args.skip || 0);
    const take = Number(args.take || filtered.length);
    return filtered.slice(skip, skip + take);
  });

  const notificationCount = jest.fn(async ({ where }: { where?: Record<string, any> } = {}) => {
    return notifications.filter((record) => matchWhere(record, where)).length;
  });

  const userFindMany = jest.fn(async ({ where, select }: any = {}) => {
    const matched = users.filter((user) => matchWhere(user as Record<string, any>, where));

    if (!select) {
      return matched;
    }

    return matched.map((user) => {
      const projected: Record<string, unknown> = {};
      for (const [field, enabled] of Object.entries(select)) {
        if (enabled) {
          projected[field] = (user as Record<string, unknown>)[field];
        }
      }
      return projected;
    });
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
          const now = new Date('2026-03-13T22:10:00.000Z');
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
    notifications,
    users,
    systemSetting: {
      findUnique: systemSettingFindUnique,
    },
    notification: {
      create: notificationCreate,
      createMany: notificationCreateMany,
      findMany: notificationFindMany,
      count: notificationCount,
    },
    user: {
      findMany: userFindMany,
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: transaction,
  };
};

describe('NotificationService dynamic notifications toggle', () => {
  const originalNotificationsEnabled = process.env.NOTIFICATIONS_ENABLED;

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
    const notificationService = new NotificationService(prisma as any, resolver);
    const notificationGateway = {
      emitNewNotification: jest.fn().mockResolvedValue(undefined),
      emitNotificationRead: jest.fn().mockResolvedValue(undefined),
      emitNotificationDeleted: jest.fn().mockResolvedValue(undefined),
    };
    const pushNotificationService = {
      getPublicKey: jest.fn().mockResolvedValue('public-key'),
      saveSubscription: jest.fn(),
      removeSubscription: jest.fn(),
    };
    const controller = new NotificationsController(
      notificationService,
      notificationGateway as any,
      pushNotificationService as any,
    );

    return {
      prisma,
      resolver,
      writeService,
      notificationService,
      notificationGateway,
      controller,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NOTIFICATIONS_ENABLED;
  });

  afterAll(() => {
    if (originalNotificationsEnabled === undefined) {
      delete process.env.NOTIFICATIONS_ENABLED;
    } else {
      process.env.NOTIFICATIONS_ENABLED = originalNotificationsEnabled;
    }
  });

  it('uses the default setting to create notifications, keeps existing notifications readable, and persists system alerts', async () => {
    const { controller, notificationGateway, notificationService, prisma } = createContext();

    await expect(controller.create(createNotificationDto, { user: requestUser } as any)).resolves.toMatchObject({
      success: true,
      notification: {
        title: 'Modulo atualizado',
      },
      suppressed: false,
      blockReason: null,
      configuration: {
        key: 'notifications.enabled',
        enabled: true,
        source: 'default',
      },
    });
    expect(notificationGateway.emitNewNotification).toHaveBeenCalledTimes(1);

    await expect(
      notificationService.emitSystemAlert({
        action: 'UPDATE_STARTED',
        severity: 'warning',
        body: 'Atualizacao iniciada',
      }),
    ).resolves.toMatchObject({
      title: 'Atualizacao iniciada',
      severity: 'warning',
    });

    const dropdown = await notificationService.findForDropdown(requestUser);
    expect(dropdown.unreadCount).toBe(2);
    expect(dropdown.hasMore).toBe(false);
    expect(dropdown.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Modulo atualizado',
        }),
      ]),
    );
    expect(prisma.notifications).toHaveLength(2);
  });

  it('applies a database override, suppresses new notifications, and restores the default fallback without affecting existing reads', async () => {
    const { controller, notificationGateway, notificationService, prisma, writeService } = createContext();

    await controller.create(createNotificationDto, { user: requestUser } as any);
    expect(prisma.notifications).toHaveLength(1);

    await writeService.updatePanelSetting('notifications.enabled', false, actor, 'Disable notifications');

    await expect(controller.create(createNotificationDto, { user: requestUser } as any)).resolves.toEqual({
      success: true,
      notification: null,
      suppressed: true,
      blockReason: 'disabled_by_configuration',
      configuration: {
        key: 'notifications.enabled',
        enabled: false,
        source: 'database',
      },
    });
    await expect(
      notificationService.createSystemNotificationEntity({
        severity: 'critical',
        title: 'Servico degradado',
        body: 'Banco em degradacao.',
        module: 'operational-alerts',
        source: 'operational-alerts',
      }),
    ).resolves.toBeNull();

    const dropdown = await notificationService.findForDropdown(requestUser);
    expect(dropdown.unreadCount).toBe(1);
    expect(dropdown.hasMore).toBe(false);
    expect(dropdown.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Modulo atualizado',
        }),
      ]),
    );
    expect(prisma.notifications).toHaveLength(1);
    expect(notificationGateway.emitNewNotification).toHaveBeenCalledTimes(1);

    await writeService.restorePanelSettingFallback('notifications.enabled', actor, 'Restore default fallback');

    await expect(controller.create(createNotificationDto, { user: requestUser } as any)).resolves.toMatchObject({
      success: true,
      notification: {
        title: 'Modulo atualizado',
      },
    });
    expect(prisma.notifications).toHaveLength(2);
    expect(notificationGateway.emitNewNotification).toHaveBeenCalledTimes(2);
  });

  it('falls back to ENV for broadcast when no database override exists', async () => {
    const { controller, notificationService, prisma } = createContext();
    process.env.NOTIFICATIONS_ENABLED = 'false';

    await expect(
      controller.broadcast(
        {
          title: 'Broadcast',
          description: 'Mensagem geral',
          type: 'info',
          scope: 'global',
          target: 'admins_only',
        } as any,
        { user: requestUser } as any,
      ),
    ).resolves.toEqual({
      count: 0,
      suppressed: true,
      blockReason: 'disabled_by_configuration',
      configuration: {
        key: 'notifications.enabled',
        enabled: false,
        source: 'env',
      },
    });

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(prisma.notifications).toHaveLength(0);
  });

  it('keeps fail-open behavior when the dynamic settings store is unavailable by falling back to default or ENV', async () => {
    const defaultContext = createContext(false);

    await expect(
      defaultContext.controller.create(createNotificationDto, { user: requestUser } as any),
    ).resolves.toMatchObject({
      success: true,
      notification: {
        title: 'Modulo atualizado',
      },
    });
    expect(defaultContext.prisma.notifications).toHaveLength(1);

    process.env.NOTIFICATIONS_ENABLED = 'false';
    const envContext = createContext(false);

    await expect(
      envContext.controller.create(createNotificationDto, { user: requestUser } as any),
    ).resolves.toEqual({
      success: true,
      notification: null,
      suppressed: true,
      blockReason: 'disabled_by_configuration',
      configuration: {
        key: 'notifications.enabled',
        enabled: false,
        source: 'env',
      },
    });
    await expect(
      envContext.notificationService.emitSystemAlert({
        action: 'UPDATE_FAILED',
        severity: 'critical',
        body: 'Falha em update.',
      }),
    ).resolves.toBeNull();
    expect(envContext.prisma.notifications).toHaveLength(0);
  });
});
