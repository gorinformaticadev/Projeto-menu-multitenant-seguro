import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { NotificationGateway } from './notification.gateway';
import { NotificationService, SystemNotificationDto } from './notification.service';

const PUSH_ELIGIBLE_SYSTEM_ALERT_ACTIONS = new Set([
  'UPDATE_FAILED',
  'UPDATE_ROLLED_BACK_AUTO',
  'RESTORE_FAILED',
  'MAINTENANCE_BYPASS_USED',
]);

@Injectable()
export class SystemAlertDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemAlertDeliveryService.name);
  private alertsSubscription: Subscription | null = null;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  onModuleInit(): void {
    this.alertsSubscription = this.notificationService.getSystemAlertStream().subscribe({
      next: (event) => {
        void this.dispatchSystemAlert(event);
      },
      error: (error) => {
        this.logger.error(`Erro no stream de system alerts: ${String(error)}`);
      },
    });
  }

  onModuleDestroy(): void {
    this.alertsSubscription?.unsubscribe();
    this.alertsSubscription = null;
  }

  private async dispatchSystemAlert(event: SystemNotificationDto): Promise<void> {
    const moduleName = String(event.module || '').trim().toLowerCase();
    if (moduleName === 'operational-alerts') {
      return;
    }

    const notification = await this.notificationService.findSystemNotificationEntityById(event.id);
    if (!notification) {
      return;
    }

    const action = String(event.data?.action || '').trim().toUpperCase();

    try {
      await this.notificationGateway.emitNewNotification(notification, {
        push: PUSH_ELIGIBLE_SYSTEM_ALERT_ACTIONS.has(action),
      });
    } catch (error) {
      this.logger.error(`Falha ao entregar system alert id=${event.id}: ${String(error)}`);
    }
  }
}
