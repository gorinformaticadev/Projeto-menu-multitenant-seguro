import { NotificationGateway } from './notification.gateway';
import { Notification } from './notification.entity';
import { NotificationService, SystemNotificationDto } from './notification.service';
import { SystemAlertDeliveryService } from './system-alert-delivery.service';

describe('SystemAlertDeliveryService', () => {
  const notificationServiceMock = {
    getSystemAlertStream: jest.fn(),
    findSystemNotificationEntityById: jest.fn(),
  };
  const notificationGatewayMock = {
    emitNewNotification: jest.fn(),
  };

  const baseNotification: Notification = {
    id: 'notif-1',
    title: 'Alerta',
    description: 'Descricao',
    type: 'error',
    tenantId: null,
    userId: null,
    read: false,
    readAt: null,
    createdAt: new Date('2026-03-07T15:00:00.000Z'),
    updatedAt: new Date('2026-03-07T15:00:00.000Z'),
    metadata: {},
  };

  const createService = () =>
    new SystemAlertDeliveryService(
      notificationServiceMock as unknown as NotificationService,
      notificationGatewayMock as unknown as NotificationGateway,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-03-07T15:00:00.000Z'));
    notificationServiceMock.findSystemNotificationEntityById.mockResolvedValue(baseNotification);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('delivers push for allowlisted critical system alert actions', async () => {
    const service = createService();

    await (service as any).dispatchSystemAlert({
      id: 'notif-1',
      type: 'SYSTEM_ALERT',
      severity: 'critical',
      title: 'Atualizacao falhou',
      body: 'Falha no update.',
      data: { action: 'UPDATE_FAILED' },
      module: 'update',
      source: 'system',
      createdAt: new Date('2026-03-07T15:00:00.000Z'),
      isRead: false,
      readAt: null,
    } satisfies SystemNotificationDto);

    expect(notificationServiceMock.findSystemNotificationEntityById).toHaveBeenCalledWith('notif-1');
    expect(notificationGatewayMock.emitNewNotification).toHaveBeenCalledWith(
      baseNotification,
      expect.objectContaining({ push: true }),
    );
  });

  it('delivers inbox-only for non-push system alert actions', async () => {
    const service = createService();

    await (service as any).dispatchSystemAlert({
      id: 'notif-2',
      type: 'SYSTEM_ALERT',
      severity: 'warning',
      title: 'Backup falhou',
      body: 'O backup falhou.',
      data: { action: 'BACKUP_FAILED' },
      module: 'backup',
      source: 'system',
      createdAt: new Date('2026-03-07T15:00:00.000Z'),
      isRead: false,
      readAt: null,
    } satisfies SystemNotificationDto);

    expect(notificationGatewayMock.emitNewNotification).toHaveBeenCalledWith(
      baseNotification,
      expect.objectContaining({ push: false }),
    );
  });

  it('skips delivery for operational alerts already handled by the central alerts service', async () => {
    const service = createService();

    await (service as any).dispatchSystemAlert({
      id: 'notif-3',
      type: 'SYSTEM_ALERT',
      severity: 'critical',
      title: 'Aumento de erros 5xx',
      body: 'A taxa de erros 5xx ultrapassou o limite configurado.',
      data: { alertAction: 'OPS_HIGH_5XX_ERROR_RATE' },
      module: 'operational-alerts',
      source: 'operational-alerts',
      createdAt: new Date('2026-03-07T15:00:00.000Z'),
      isRead: false,
      readAt: null,
    } satisfies SystemNotificationDto);

    expect(notificationServiceMock.findSystemNotificationEntityById).not.toHaveBeenCalled();
    expect(notificationGatewayMock.emitNewNotification).not.toHaveBeenCalled();
  });

  it('applies cooldown to repeated legacy critical alerts and re-delivers after the window', async () => {
    const service = createService();
    const event: SystemNotificationDto = {
      id: 'notif-4',
      type: 'SYSTEM_ALERT',
      severity: 'critical',
      title: 'Rollback automatico executado',
      body: 'Update terminou com rollback automatico.',
      data: { action: 'UPDATE_ROLLED_BACK_AUTO' },
      module: 'update',
      source: 'system',
      createdAt: new Date('2026-03-07T15:00:00.000Z'),
      isRead: false,
      readAt: null,
    };

    await (service as any).dispatchSystemAlert(event);
    await (service as any).dispatchSystemAlert(event);

    expect(notificationGatewayMock.emitNewNotification).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(16 * 60 * 1000);
    await (service as any).dispatchSystemAlert(event);

    expect(notificationGatewayMock.emitNewNotification).toHaveBeenCalledTimes(2);
  });
});
