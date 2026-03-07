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
const DEFAULT_SYSTEM_ALERT_DELIVERY_COOLDOWN_MINUTES = 15;

@Injectable()
export class SystemAlertDeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemAlertDeliveryService.name);
  private alertsSubscription: Subscription | null = null;
  private readonly cooldownState = new Map<string, number>();

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

    const action = String(event.data?.action || '').trim().toUpperCase();
    const pushEligible = PUSH_ELIGIBLE_SYSTEM_ALERT_ACTIONS.has(action);
    if (pushEligible && !this.shouldDeliverAction(action)) {
      return;
    }

    const notification = await this.notificationService.findSystemNotificationEntityById(event.id);
    if (!notification) {
      return;
    }

    try {
      await this.notificationGateway.emitNewNotification(notification, {
        push: pushEligible,
      });
      if (pushEligible) {
        this.markActionDelivered(action);
      }
    } catch (error) {
      this.logger.error(`Falha ao entregar system alert id=${event.id}: ${String(error)}`);
    }
  }

  private shouldDeliverAction(action: string): boolean {
    this.pruneCooldownState(Date.now());
    const cooldownUntil = this.cooldownState.get(action) || 0;
    return cooldownUntil <= Date.now();
  }

  private markActionDelivered(action: string): void {
    const cooldownMinutes = this.readCooldownMinutes();
    this.cooldownState.set(action, Date.now() + cooldownMinutes * 60 * 1000);
  }

  private pruneCooldownState(nowMs: number): void {
    for (const [key, expiresAt] of this.cooldownState.entries()) {
      if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
        this.cooldownState.delete(key);
      }
    }
  }

  private readCooldownMinutes(): number {
    const raw = Number.parseInt(String(process.env.OPS_ALERT_COOLDOWN_MINUTES || ''), 10);
    if (!Number.isFinite(raw) || raw <= 0) {
      return DEFAULT_SYSTEM_ALERT_DELIVERY_COOLDOWN_MINUTES;
    }

    return Math.min(raw, 24 * 60);
  }
}
