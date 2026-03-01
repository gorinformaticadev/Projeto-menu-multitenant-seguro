import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/prisma/prisma.service';
import { decryptSensitiveData } from '@core/common/utils/security.utils';
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

interface ResolvedVapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
  source: 'database' | 'env';
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private webPush: WebPushModuleLike | null = null;
  private enabled = false;
  private cachedConfig: ResolvedVapidConfig | null = null;
  private cachedConfigAt = 0;
  private lastVapidFingerprint: string | null = null;
  private warnedMissingConfig = false;
  private warnedMissingDependency = false;
  private readonly configCacheTtlMs = 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getPublicKey(): Promise<string | null> {
    const config = await this.getResolvedVapidConfig();
    if (!config) {
      return null;
    }

    await this.initialize(config);
    return this.enabled ? config.publicKey : null;
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
    const config = await this.getResolvedVapidConfig();
    if (!config) {
      return;
    }

    await this.initialize(config);

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

  private async initialize(config: ResolvedVapidConfig): Promise<void> {
    const vapidFingerprint = `${config.subject}|${config.publicKey}|${config.privateKey}`;
    if (this.enabled && this.webPush && this.lastVapidFingerprint === vapidFingerprint) {
      return;
    }

    try {
      if (!this.webPush) {
        // Dependencia opcional para nao quebrar instalacoes existentes.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.webPush = require('web-push') as WebPushModuleLike;
      }

      this.webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
      this.lastVapidFingerprint = vapidFingerprint;
      this.enabled = true;
      this.warnedMissingDependency = false;
    } catch (error) {
      this.enabled = false;
      if (!this.warnedMissingDependency) {
        this.warnedMissingDependency = true;
        this.logger.warn(
          'Web Push desabilitado: dependencia "web-push" nao encontrada. Execute a atualizacao para instalar as dependencias.',
        );
        this.logger.debug(`Detalhe: ${(error as Error)?.message || String(error)}`);
      }
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

  private async getResolvedVapidConfig(): Promise<ResolvedVapidConfig | null> {
    if (
      this.cachedConfig &&
      Date.now() - this.cachedConfigAt < this.configCacheTtlMs
    ) {
      return this.cachedConfig;
    }

    const databaseConfig = await this.getVapidConfigFromDatabase();
    const envConfig = this.getVapidConfigFromEnv();
    const resolved = databaseConfig || envConfig;

    this.cachedConfig = resolved;
    this.cachedConfigAt = Date.now();

    if (!resolved && !this.warnedMissingConfig) {
      this.warnedMissingConfig = true;
      this.logger.warn(
        'Web Push desabilitado: configure WEB_PUSH_PUBLIC_KEY/WEB_PUSH_PRIVATE_KEY no painel ou no .env.',
      );
    }

    if (resolved) {
      this.warnedMissingConfig = false;
    }

    return resolved;
  }

  private async getVapidConfigFromDatabase(): Promise<ResolvedVapidConfig | null> {
    try {
      const config = await this.prisma.securityConfig.findFirst({
        select: {
          webPushPublicKey: true,
          webPushPrivateKey: true,
          webPushSubject: true,
        },
      });

      const publicKey = this.normalizeString(config?.webPushPublicKey);
      const privateKeyRaw = this.normalizeString(config?.webPushPrivateKey);

      if (!publicKey || !privateKeyRaw) {
        return null;
      }

      const privateKey = this.tryDecryptPrivateKey(privateKeyRaw);
      if (!privateKey) {
        return null;
      }

      return {
        publicKey,
        privateKey,
        subject:
          this.normalizeString(config?.webPushSubject) || 'mailto:suporte@example.com',
        source: 'database',
      };
    } catch (error) {
      this.logger.error('Falha ao carregar configuracao de Web Push do banco:', error);
      return null;
    }
  }

  private getVapidConfigFromEnv(): ResolvedVapidConfig | null {
    const publicKey = this.normalizeString(
      this.configService.get<string>('WEB_PUSH_PUBLIC_KEY'),
    );
    const privateKey = this.normalizeString(
      this.configService.get<string>('WEB_PUSH_PRIVATE_KEY'),
    );

    if (!publicKey || !privateKey) {
      return null;
    }

    return {
      publicKey,
      privateKey,
      subject:
        this.normalizeString(this.configService.get<string>('WEB_PUSH_SUBJECT')) ||
        'mailto:suporte@example.com',
      source: 'env',
    };
  }

  private tryDecryptPrivateKey(raw: string): string | null {
    try {
      return decryptSensitiveData(raw);
    } catch {
      // Compatibilidade com dados legados salvos sem criptografia.
      return this.normalizeString(raw);
    }
  }

  private normalizeString(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
  }
}
