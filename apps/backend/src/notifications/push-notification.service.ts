import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/prisma/prisma.service';
import { Notification } from './notification.entity';
import { SavePushSubscriptionDto } from './notification.dto';

interface AuthenticatedUser {
  id: string;
  tenantId?: string | null;
  role?: string;
}

interface WebPushModuleLike {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload?: string,
  ): Promise<unknown>;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly vapidPublicKey: string | null;
  private readonly vapidPrivateKey: string | null;
  private readonly vapidSubject: string;
  private webPush: WebPushModuleLike | null = null;
  private enabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.vapidPublicKey = this.configService.get<string>('WEB_PUSH_PUBLIC_KEY') || null;
    this.vapidPrivateKey = this.configService.get<string>('WEB_PUSH_PRIVATE_KEY') || null;
    this.vapidSubject =
      this.configService.get<string>('WEB_PUSH_SUBJECT') || 'mailto:suporte@example.com';

    this.initialize();
  }

  getPublicKey(): string | null {
    return this.enabled ? this.vapidPublicKey : null;
  }

  async saveSubscription(
    user: AuthenticatedUser,
    subscription: SavePushSubscriptionDto,
    userAgent?: string,
  ): Promise<boolean> {
    const endpoint = subscription?.endpoint?.trim();
    const p256dh = subscription?.keys?.p256dh?.trim();
    const auth = subscription?.keys?.auth?.trim();

    if (!user?.id || !endpoint || !p256dh || !auth) {
      return false;
    }

    await this.prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId: user.id,
          endpoint,
        },
      },
      create: {
        userId: user.id,
        tenantId: user.tenantId || null,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent || null,
        lastUsedAt: new Date(),
      },
      update: {
        tenantId: user.tenantId || null,
        p256dh,
        auth,
        userAgent: userAgent || null,
        lastUsedAt: new Date(),
      },
    });

    return true;
  }

  async removeSubscription(user: AuthenticatedUser, endpoint: string): Promise<number> {
    if (!user?.id || !endpoint) {
      return 0;
    }

    const result = await this.prisma.pushSubscription.deleteMany({
      where: {
        userId: user.id,
        endpoint,
      },
    });

    return result.count;
  }

  async sendNotification(notification: Notification): Promise<void> {
    if (!this.enabled || !this.webPush) {
      return;
    }

    try {
      const targetUserIds = await this.resolveTargetUserIds(notification);
      if (targetUserIds.length === 0) {
        return;
      }

      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: {
          userId: { in: targetUserIds },
        },
        select: {
          id: true,
          endpoint: true,
          p256dh: true,
          auth: true,
        },
      });

      if (subscriptions.length === 0) {
        return;
      }

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.description,
        url: '/notifications',
        notificationId: notification.id,
        type: notification.type,
        tenantId: notification.tenantId || null,
        createdAt: notification.createdAt,
      });

      const staleIds: string[] = [];
      const successIds: string[] = [];

      await Promise.all(
        subscriptions.map(async (sub) => {
          try {
            await this.webPush!.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload,
            );
            successIds.push(sub.id);
          } catch (error: unknown) {
            const statusCode =
              ((error as { statusCode?: number; status?: number })?.statusCode ??
                (error as { statusCode?: number; status?: number })?.status) ||
              0;

            if (statusCode === 404 || statusCode === 410) {
              staleIds.push(sub.id);
              return;
            }

            this.logger.warn(
              `Falha ao enviar push (subscriptionId=${sub.id}, status=${statusCode || 'unknown'})`,
            );
          }
        }),
      );

      if (successIds.length > 0) {
        await this.prisma.pushSubscription.updateMany({
          where: { id: { in: successIds } },
          data: { lastUsedAt: new Date() },
        });
      }

      if (staleIds.length > 0) {
        await this.prisma.pushSubscription.deleteMany({
          where: { id: { in: staleIds } },
        });
      }
    } catch (error) {
      this.logger.error('Erro ao enviar notificacao push (nao critico):', error);
    }
  }

  private initialize(): void {
    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      this.logger.warn(
        'Web Push desabilitado: WEB_PUSH_PUBLIC_KEY/WEB_PUSH_PRIVATE_KEY nao configuradas.',
      );
      return;
    }

    try {
      // Dependencia opcional para nao quebrar instalacoes existentes.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const webPush = require('web-push') as WebPushModuleLike;

      webPush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey);
      this.webPush = webPush;
      this.enabled = true;
      this.logger.log('Web Push habilitado com sucesso.');
    } catch (error) {
      this.enabled = false;
      this.logger.warn(
        'Web Push desabilitado: dependencia "web-push" nao encontrada. Instale com "pnpm -C apps/backend add web-push".',
      );
      this.logger.debug(`Detalhe: ${(error as Error)?.message || String(error)}`);
    }
  }

  private async resolveTargetUserIds(notification: Notification): Promise<string[]> {
    if (notification.userId) {
      return [notification.userId];
    }

    if (notification.tenantId) {
      const users = await this.prisma.user.findMany({
        where: {
          tenantId: notification.tenantId,
          role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        },
        select: { id: true },
      });

      return users.map((u) => u.id);
    }

    const superAdmins = await this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });

    return superAdmins.map((u) => u.id);
  }
}
