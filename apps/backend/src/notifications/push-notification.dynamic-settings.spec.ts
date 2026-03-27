import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/prisma/prisma.service';
import { ConfigResolverService } from '../system-settings/config-resolver.service';
import { SettingsRegistry } from '../system-settings/settings-registry.service';
import { Notification } from './notification.entity';
import { PushNotificationService } from './push-notification.service';
import { AuthorizationService } from '@common/services/authorization.service';

type PushToggleState = {
  available: boolean;
  value?: boolean;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type InMemoryPrisma = {
  toggleState: PushToggleState;
  systemSetting: {
    findUnique: jest.Mock<Promise<any>, [any]>;
  };
  securityConfig: {
    findFirst: jest.Mock<Promise<any>, [any?]>;
  };
  pushSubscription: {
    findMany: jest.Mock<Promise<PushSubscriptionRow[]>, [any]>;
    updateMany: jest.Mock<Promise<{ count: number }>, [any]>;
    deleteMany: jest.Mock<Promise<{ count: number }>, [any]>;
  };
  user: {
    findMany: jest.Mock<Promise<Array<{ id: string }>>, [any]>;
  };
};

const originalEnv = { ...process.env };

const baseNotification: Notification = {
  id: 'notif-1',
  title: 'Servico degradado',
  description: 'Banco de dados apresentou degradacao persistente.',
  type: 'error',
  tenantId: null,
  userId: null,
  read: false,
  readAt: null,
  createdAt: new Date('2026-03-14T12:00:00.000Z'),
  updatedAt: new Date('2026-03-14T12:00:00.000Z'),
  metadata: {},
};

const createPrisma = (
  toggleState: PushToggleState = { available: true },
  subscriptions: PushSubscriptionRow[] = [
    {
      id: 'sub-1',
      endpoint: 'https://push.example/subscription-a',
      p256dh: 'key-a',
      auth: 'auth-a',
    },
    {
      id: 'sub-2',
      endpoint: 'https://push.example/subscription-a',
      p256dh: 'key-a',
      auth: 'auth-a',
    },
    {
      id: 'sub-3',
      endpoint: 'https://push.example/subscription-b',
      p256dh: 'key-b',
      auth: 'auth-b',
    },
  ],
): InMemoryPrisma => ({
  toggleState,
  systemSetting: {
    findUnique: jest.fn(async ({ where }: { where: { key: string } }) => {
      if (!toggleState.available) {
        throw new Error('dynamic settings db offline');
      }

      if (where?.key !== 'notifications.push.enabled' || toggleState.value === undefined) {
        return null;
      }

      return {
        key: 'notifications.push.enabled',
        valueJson: toggleState.value,
      };
    }),
  },
  securityConfig: {
    findFirst: jest.fn(async () => null),
  },
  pushSubscription: {
    findMany: jest.fn(async (_args: any) => subscriptions),
    updateMany: jest.fn(async ({ where }: any) => ({
      count: Array.isArray(where?.id?.in) ? where.id.in.length : 0,
    })),
    deleteMany: jest.fn(async ({ where }: any) => ({
      count: Array.isArray(where?.id?.in) ? where.id.in.length : 0,
    })),
  },
  user: {
    findMany: jest.fn(async (_args: any) => [{ id: 'admin-1' }, { id: 'admin-2' }]),
  },
});

const createContext = (
  toggleState: PushToggleState = { available: true },
  subscriptions?: PushSubscriptionRow[],
) => {
  const prisma = createPrisma(toggleState, subscriptions);
  const configService = {
    get: jest.fn((key: string) => process.env[key]),
  };
  const resolver = new ConfigResolverService(new SettingsRegistry(), prisma as unknown as PrismaService);
  const authorizationService = {
    canReceiveNotification: jest.fn().mockReturnValue(true),
  };
  const service = new PushNotificationService(
    prisma as unknown as PrismaService,
    configService as unknown as ConfigService,
    resolver,
    authorizationService as unknown as AuthorizationService,
  );
  const sendNotificationMock = jest.fn().mockResolvedValue(undefined);
  const setVapidDetailsMock = jest.fn();

  jest.spyOn(service as any, 'initialize').mockImplementation(async function initialize(this: any) {
    this.enabled = true;
    this.webPush = {
      sendNotification: sendNotificationMock,
      setVapidDetails: setVapidDetailsMock,
    };
  });
  jest.spyOn(service as any, 'validatePushEndpoint').mockResolvedValue(undefined);

  return {
    prisma,
    service,
    sendNotificationMock,
    setVapidDetailsMock,
    configService,
  };
};

describe('PushNotificationService dynamic push toggle', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      WEB_PUSH_PUBLIC_KEY: 'public-key',
      WEB_PUSH_PRIVATE_KEY: 'private-key',
      WEB_PUSH_SUBJECT: 'mailto:test@example.com',
    };
    delete process.env.NOTIFICATIONS_PUSH_ENABLED;
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-14T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('does not attempt Web Push by default when no override exists', async () => {
    const { service, prisma, sendNotificationMock } = createContext();

    await service.sendNotification(baseNotification);

    expect(prisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('attempts Web Push when enabled by ENV', async () => {
    process.env.NOTIFICATIONS_PUSH_ENABLED = 'true';
    const { service, prisma, sendNotificationMock } = createContext();

    await service.sendNotification(baseNotification);

    expect(prisma.pushSubscription.findMany).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
  });

  it('lets a database override disable push even when ENV is enabled', async () => {
    process.env.NOTIFICATIONS_PUSH_ENABLED = 'true';
    const { service, prisma, sendNotificationMock } = createContext({
      available: true,
      value: false,
    });

    await service.sendNotification(baseNotification);

    expect(prisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('lets a database override enable push even when ENV is disabled', async () => {
    process.env.NOTIFICATIONS_PUSH_ENABLED = 'false';
    const { service, prisma, sendNotificationMock } = createContext({
      available: true,
      value: true,
    });

    await service.sendNotification(baseNotification);

    expect(prisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to ENV when the dynamic settings database is unavailable', async () => {
    process.env.NOTIFICATIONS_PUSH_ENABLED = 'true';
    const { service, prisma, sendNotificationMock } = createContext({
      available: false,
    });

    await service.sendNotification(baseNotification);

    expect(prisma.systemSetting.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
  });

  it('restores ENV fallback after removing the database override and expiring the cache', async () => {
    process.env.NOTIFICATIONS_PUSH_ENABLED = 'true';
    const toggleState = {
      available: true,
      value: false,
    };
    const { service, prisma, sendNotificationMock } = createContext(toggleState);

    await service.sendNotification(baseNotification);
    expect(sendNotificationMock).not.toHaveBeenCalled();

    toggleState.value = undefined;
    sendNotificationMock.mockClear();
    prisma.pushSubscription.findMany.mockClear();

    jest.advanceTimersByTime(16000);

    await service.sendNotification(baseNotification);

    expect(prisma.systemSetting.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
  });

  it('keeps public key availability separate from push delivery enablement', async () => {
    const { service, sendNotificationMock } = createContext({
      available: true,
      value: false,
    });

    const publicKey = await service.getPublicKey();
    await service.sendNotification(baseNotification);

    expect(publicKey).toBe('public-key');
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('preserves current behavior when VAPID keys are missing', async () => {
    delete process.env.WEB_PUSH_PUBLIC_KEY;
    delete process.env.WEB_PUSH_PRIVATE_KEY;
    process.env.NOTIFICATIONS_PUSH_ENABLED = 'true';
    const { service, prisma, sendNotificationMock } = createContext({
      available: true,
      value: true,
    });

    await service.sendNotification(baseNotification);

    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('preserves current behavior when there is no subscription to deliver', async () => {
    process.env.NOTIFICATIONS_PUSH_ENABLED = 'true';
    const { service, prisma, sendNotificationMock } = createContext(
      {
        available: true,
        value: true,
      },
      [],
    );

    await service.sendNotification(baseNotification);

    expect(prisma.pushSubscription.findMany).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });
});
