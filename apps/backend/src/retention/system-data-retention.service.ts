import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CronService } from '../core/cron/cron.service';
import { PrismaService } from '../core/prisma/prisma.service';

const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 180;
const DEFAULT_NOTIFICATION_READ_RETENTION_DAYS = 30;
const DEFAULT_RETENTION_DELETE_LIMIT = 5000;
const RETENTION_CRON_SCHEDULE = '30 3 * * *';

export type RetentionRunSource = 'cron' | 'manual' | 'system';

export interface RetentionCleanupSummary {
  deletedAuditLogs: number;
  deletedNotifications: number;
  auditCutoff: Date;
  notificationCutoff: Date;
  auditRetentionDays: number;
  notificationRetentionDays: number;
  maxDeletePerRun: number;
  errors: string[];
}

@Injectable()
export class SystemDataRetentionService implements OnModuleInit {
  private readonly logger = new Logger(SystemDataRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronService: CronService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerCronJob();
  }

  async runRetentionCleanup(source: RetentionRunSource = 'system'): Promise<RetentionCleanupSummary> {
    const auditRetentionDays = this.readRetentionDays(
      'AUDIT_LOG_RETENTION_DAYS',
      DEFAULT_AUDIT_LOG_RETENTION_DAYS,
    );
    const notificationRetentionDays = this.readRetentionDays(
      'NOTIFICATION_READ_RETENTION_DAYS',
      DEFAULT_NOTIFICATION_READ_RETENTION_DAYS,
    );
    const maxDeletePerRun = this.readPositiveInt(
      'SYSTEM_RETENTION_DELETE_LIMIT',
      DEFAULT_RETENTION_DELETE_LIMIT,
      100000,
    );

    const auditCutoff = this.buildCutoffDate(auditRetentionDays);
    const notificationCutoff = this.buildCutoffDate(notificationRetentionDays);

    const errors: string[] = [];

    const deletedAuditLogs = await this.cleanupAuditLogs(auditCutoff, maxDeletePerRun).catch((error) => {
      const message = this.normalizeErrorMessage(error);
      this.logger.error(`Falha ao limpar audit logs: ${message}`);
      errors.push(`audit: ${message}`);
      return 0;
    });

    const deletedNotifications = await this.cleanupNotifications(
      notificationCutoff,
      maxDeletePerRun,
    ).catch((error) => {
      const message = this.normalizeErrorMessage(error);
      this.logger.error(`Falha ao limpar notificacoes: ${message}`);
      errors.push(`notifications: ${message}`);
      return 0;
    });

    if (errors.length > 0) {
      await this.registerAuditFailure({
        source,
        auditCutoff,
        notificationCutoff,
        auditRetentionDays,
        notificationRetentionDays,
        errors,
      });
    }

    const summary: RetentionCleanupSummary = {
      deletedAuditLogs,
      deletedNotifications,
      auditCutoff,
      notificationCutoff,
      auditRetentionDays,
      notificationRetentionDays,
      maxDeletePerRun,
      errors,
    };

    this.logger.log(
      `Retention cleanup executed: source=${source} auditLogsDeleted=${deletedAuditLogs} notificationsDeleted=${deletedNotifications} limit=${maxDeletePerRun}`,
    );

    return summary;
  }

  async cleanupAuditLogs(auditCutoff: Date, limit: number): Promise<number> {
    const candidates = await this.prisma.auditLog.findMany({
      where: {
        createdAt: {
          lt: auditCutoff,
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    if (candidates.length === 0) {
      return 0;
    }

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        id: {
          in: candidates.map((row) => row.id),
        },
      },
    });

    if (candidates.length >= limit) {
      this.logger.warn(
        `Limite de limpeza de audit logs atingido (${limit}) nesta execucao; continuar em execucoes seguintes.`,
      );
    }

    return result.count || 0;
  }

  async cleanupNotifications(notificationCutoff: Date, limit: number): Promise<number> {
    const candidates = await this.prisma.notification.findMany({
      where: {
        isRead: true,
        OR: [
          {
            readAt: {
              lt: notificationCutoff,
            },
          },
          {
            readAt: null,
            createdAt: {
              lt: notificationCutoff,
            },
          },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    if (candidates.length === 0) {
      return 0;
    }

    const result = await this.prisma.notification.deleteMany({
      where: {
        id: {
          in: candidates.map((row) => row.id),
        },
      },
    });

    if (candidates.length >= limit) {
      this.logger.warn(
        `Limite de limpeza de notificacoes atingido (${limit}) nesta execucao; continuar em execucoes seguintes.`,
      );
    }

    return result.count || 0;
  }

  private async registerCronJob(): Promise<void> {
    await this.cronService.register(
      'system.system_data_retention',
      RETENTION_CRON_SCHEDULE,
      async () => {
        this.logger.log('Iniciando housekeeping de retencao (AuditLog + Notification)');
        const summary = await this.runRetentionCleanup('cron');

        if (summary.errors.length > 0) {
          this.logger.warn(
            `Housekeeping concluido com falhas: ${summary.errors.join(' | ')}`,
          );
          return;
        }

        this.logger.log(
          `Housekeeping concluido: audit=${summary.deletedAuditLogs}, notifications=${summary.deletedNotifications}`,
        );
      },
      {
        name: 'system_data_retention',
        description:
          'Executa retencao de AuditLog e Notifications lidas conforme politica configurada.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
      },
    );
  }

  private readRetentionDays(envName: string, fallback: number): number {
    const raw = String(process.env[envName] || '').trim();
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.min(parsed, 3650);
  }

  private readPositiveInt(envName: string, fallback: number, maxValue: number): number {
    const raw = String(process.env[envName] || '').trim();
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.min(parsed, maxValue);
  }

  private buildCutoffDate(retentionDays: number): Date {
    const now = new Date();
    return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  }

  private async registerAuditFailure(payload: {
    source: RetentionRunSource;
    auditCutoff: Date;
    notificationCutoff: Date;
    auditRetentionDays: number;
    notificationRetentionDays: number;
    errors: string[];
  }): Promise<void> {
    try {
      await this.auditService.log({
        action: 'SYSTEM_DATA_RETENTION_FAILED',
        severity: 'warning',
        message: 'Falha durante housekeeping de retencao de dados do sistema',
        metadata: {
          source: payload.source,
          auditRetentionDays: payload.auditRetentionDays,
          notificationRetentionDays: payload.notificationRetentionDays,
          auditCutoff: payload.auditCutoff.toISOString(),
          notificationCutoff: payload.notificationCutoff.toISOString(),
          errors: payload.errors,
        },
      });
    } catch (error) {
      this.logger.error(
        `Falha ao registrar auditoria de erro de retencao: ${this.normalizeErrorMessage(error)}`,
      );
    }
  }

  private normalizeErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }

    return String(error);
  }
}
