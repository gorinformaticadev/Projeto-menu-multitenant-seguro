import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/prisma/prisma.service';
import { Notification } from './notification.entity';
import { PushNotificationService } from './push-notification.service';
import { ConfigResolverService } from '../system-settings/config-resolver.service';

describe('PushNotificationService', () => {
  const prismaMock = {
    pushSubscription: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };
  const configServiceMock = {
    get: jest.fn(),
  };
  const configResolverMock = {
    getResolved: jest.fn().mockResolvedValue({
      key: 'notifications.push.enabled',
      value: true,
      source: 'default',
    }),
  };

  const baseNotification: Notification = {
    id: 'notif-1',
    title: 'Servico degradado',
    description: 'Banco de dados apresentou degradacao persistente.',
    type: 'error',
    tenantId: null,
    userId: null,
    read: false,
    readAt: null,
    createdAt: new Date('2026-03-07T16:00:00.000Z'),
    updatedAt: new Date('2026-03-07T16:00:00.000Z'),
    metadata: {},
  };

  const createService = () =>
    new PushNotificationService(
      prismaMock as unknown as PrismaService,
      configServiceMock as unknown as ConfigService,
      configResolverMock as unknown as ConfigResolverService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);
    prismaMock.pushSubscription.findMany.mockResolvedValue([
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
    ]);
    prismaMock.pushSubscription.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.pushSubscription.deleteMany.mockResolvedValue({ count: 0 });
    configResolverMock.getResolved.mockResolvedValue({
      key: 'notifications.push.enabled',
      value: true,
      source: 'default',
    });
  });

  it('deduplicates subscriptions by endpoint before sending push', async () => {
    const service = createService();
    const sendNotificationMock = jest.fn().mockResolvedValue(undefined);

    jest.spyOn(service as any, 'getResolvedVapidConfig').mockResolvedValue({
      publicKey: 'public-key',
      privateKey: 'private-key',
      subject: 'mailto:test@example.com',
      source: 'env',
    });
    jest.spyOn(service as any, 'initialize').mockImplementation(async function initialize(this: any) {
      this.enabled = true;
      this.webPush = {
        sendNotification: sendNotificationMock,
        setVapidDetails: jest.fn(),
      };
    });

    await service.sendNotification(baseNotification);

    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    expect(sendNotificationMock.mock.calls[0][0].endpoint).toBe('https://push.example/subscription-a');
    expect(sendNotificationMock.mock.calls[1][0].endpoint).toBe('https://push.example/subscription-b');
  });
});
