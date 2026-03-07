import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackupJobStatus } from '@prisma/client';
import Redis from 'ioredis';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationGateway } from '../../notifications/notification.gateway';
import { NotificationService, SystemNotificationSeverity } from '../../notifications/notification.service';
import { PushNotificationService } from '../../notifications/push-notification.service';
import {
  ApiTelemetrySnapshot,
  RouteTelemetrySummary,
  SecurityTelemetrySnapshot,
  SystemTelemetryService,
} from './system-telemetry.service';

type InfraServiceKey = 'database' | 'redis';

type EvaluatorConfig = {
  windowMinutes: number;
  cooldownMinutes: number;
  rate5xxThreshold: number;
  minRequestSample: number;
  routeLatencyMsThreshold: number;
  minRouteSample: number;
  deniedSpikeThreshold: number;
  minDeniedSample: number;
  jobFailureStormThreshold: number;
  infraDegradedMinConsecutive: number;
};

type AlertDispatchInput = {
  action: string;
  cooldownKey: string;
  severity: SystemNotificationSeverity;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  pushEligible?: boolean;
  audit?: boolean;
  source?: string;
};

type InfraHealthMetric = {
  status: 'healthy' | 'degraded' | 'error' | 'down' | 'not_configured';
  latencyMs: number | null;
};

const DEFAULT_ALERT_WINDOW_MINUTES = 5;
const DEFAULT_ALERT_COOLDOWN_MINUTES = 15;
const DEFAULT_ALERT_5XX_RATE_THRESHOLD = 5;
const DEFAULT_ALERT_MIN_REQUEST_SAMPLE = 30;
const DEFAULT_ALERT_ROUTE_LATENCY_MS_THRESHOLD = 1_500;
const DEFAULT_ALERT_MIN_ROUTE_SAMPLE = 5;
const DEFAULT_ALERT_DENIED_SPIKE_THRESHOLD = 12;
const DEFAULT_ALERT_MIN_DENIED_SAMPLE = 10;
const DEFAULT_ALERT_JOB_FAILURE_STORM_THRESHOLD = 3;
const DEFAULT_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE = 3;

@Injectable()
export class SystemOperationalAlertsService {
  private readonly logger = new Logger(SystemOperationalAlertsService.name);
  private readonly lockId = this.readIntFromEnv('OPS_ALERTS_LOCK_ID', 98542174, 1, Number.MAX_SAFE_INTEGER);
  private readonly advisoryLockEnabled =
    String(process.env.OPS_ALERTS_USE_ADVISORY_LOCK || 'true').toLowerCase() !== 'false';
  private readonly cooldownState = new Map<string, number>();
  private readonly infraDegradedCounts = new Map<InfraServiceKey, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemTelemetryService: SystemTelemetryService,
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
    private readonly pushNotificationService: PushNotificationService,
    private readonly auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'system_operational_alerts_evaluator',
  })
  async handleOperationalAlertsEvaluator(): Promise<void> {
    const lockAcquired = await this.tryAcquireAdvisoryLock();
    if (!lockAcquired) {
      this.logger.log('Operational alerts evaluator skipped: lock is held by another instance.');
      return;
    }

    try {
      await this.evaluateOperationalAlerts();
    } catch (error) {
      this.logger.error('Operational alerts evaluator failed.', error as Error);
    } finally {
      await this.releaseAdvisoryLock();
    }
  }

  async evaluateOperationalAlerts(
    now = new Date(),
  ): Promise<{
    emitted: string[];
    skipped: string[];
  }> {
    const config = this.getEvaluatorConfig();
    const nowMs = now.getTime();
    const windowMs = config.windowMinutes * 60 * 1000;
    const apiSnapshot = this.systemTelemetryService.getApiSnapshot(windowMs);
    const securitySnapshot = this.systemTelemetryService.getSecuritySnapshot(windowMs);
    const emitted: string[] = [];
    const skipped: string[] = [];

    this.pruneCooldownState(nowMs);

    if (
      await this.evaluateHigh5xxErrorRateAlert(apiSnapshot, config, nowMs)
    ) {
      emitted.push('OPS_HIGH_5XX_ERROR_RATE');
    } else {
      skipped.push('OPS_HIGH_5XX_ERROR_RATE');
    }

    const slowRoute = this.findCriticalSlowRoute(apiSnapshot, config);
    if (slowRoute) {
      const slowRouteKey = `${slowRoute.method} ${slowRoute.route}`;
      if (await this.emitAlertIfNeeded({
        action: 'OPS_CRITICAL_SLOW_ROUTE',
        cooldownKey: `OPS_CRITICAL_SLOW_ROUTE:${slowRouteKey}`,
        severity: 'warning',
        title: 'Rota critica com latencia alta',
        body: `A rota ${slowRoute.method} ${slowRoute.route} ultrapassou a latencia media configurada.`,
        data: {
          route: slowRoute.route,
          method: slowRoute.method,
          avgMs: slowRoute.avgMs,
          p95Ms: slowRoute.p95Ms,
          requestCount: slowRoute.requestCount,
          thresholdMs: config.routeLatencyMsThreshold,
          windowMinutes: config.windowMinutes,
        },
      }, nowMs, config.cooldownMinutes)) {
        emitted.push(`OPS_CRITICAL_SLOW_ROUTE:${slowRouteKey}`);
      } else {
        skipped.push(`OPS_CRITICAL_SLOW_ROUTE:${slowRouteKey}`);
      }
    } else {
      skipped.push('OPS_CRITICAL_SLOW_ROUTE');
    }

    if (
      await this.evaluateAccessDeniedSpikeAlert(securitySnapshot, config, nowMs)
    ) {
      emitted.push('OPS_ACCESS_DENIED_SPIKE');
    } else {
      skipped.push('OPS_ACCESS_DENIED_SPIKE');
    }

    if (
      await this.evaluateJobFailureStormAlert(config, now, nowMs)
    ) {
      emitted.push('OPS_JOB_FAILURE_STORM');
    } else {
      skipped.push('OPS_JOB_FAILURE_STORM');
    }

    const infraAlerts = await this.evaluateInfraAlerts(config, nowMs);
    emitted.push(...infraAlerts.emitted);
    skipped.push(...infraAlerts.skipped);

    return { emitted, skipped };
  }

  async notifyMaintenanceBypassUsed(input: {
    method: string;
    route: string;
  }): Promise<boolean> {
    return this.emitAlertIfNeeded(
      {
        action: 'MAINTENANCE_BYPASS_USED',
        cooldownKey: 'MAINTENANCE_BYPASS_USED',
        severity: 'critical',
        title: 'Bypass de manutencao utilizado',
        body: `SUPER_ADMIN utilizou bypass de manutencao em ${input.method} ${input.route}.`,
        data: {
          method: input.method,
          route: input.route,
        },
        pushEligible: true,
        audit: false,
        source: 'maintenance',
      },
      Date.now(),
      this.getEvaluatorConfig().cooldownMinutes,
    );
  }

  private async evaluateHigh5xxErrorRateAlert(
    snapshot: ApiTelemetrySnapshot,
    config: EvaluatorConfig,
    nowMs: number,
  ): Promise<boolean> {
    if (snapshot.totalRequestsRecent < config.minRequestSample || snapshot.total5xxCount <= 0) {
      return false;
    }

    if (snapshot.error5xxRateRecent < config.rate5xxThreshold) {
      return false;
    }

    return this.emitAlertIfNeeded(
      {
        action: 'OPS_HIGH_5XX_ERROR_RATE',
        cooldownKey: 'OPS_HIGH_5XX_ERROR_RATE',
        severity: 'critical',
        title: 'Aumento de erros 5xx',
        body: 'A taxa de erros 5xx ultrapassou o limite configurado.',
        data: {
          windowMinutes: config.windowMinutes,
          requestCount: snapshot.totalRequestsRecent,
          total5xxCount: snapshot.total5xxCount,
          error5xxRateRecent: snapshot.error5xxRateRecent,
          threshold: config.rate5xxThreshold,
        },
        pushEligible: true,
        audit: true,
      },
      nowMs,
      config.cooldownMinutes,
    );
  }

  private async evaluateAccessDeniedSpikeAlert(
    snapshot: SecurityTelemetrySnapshot,
    config: EvaluatorConfig,
    nowMs: number,
  ): Promise<boolean> {
    if (snapshot.deniedSpikeCountRecent < config.minDeniedSample) {
      return false;
    }

    if (snapshot.deniedSpikeCountRecent < config.deniedSpikeThreshold) {
      return false;
    }

    return this.emitAlertIfNeeded(
      {
        action: 'OPS_ACCESS_DENIED_SPIKE',
        cooldownKey: 'OPS_ACCESS_DENIED_SPIKE',
        severity: 'warning',
        title: 'Pico de acessos negados',
        body: 'O sistema detectou aumento relevante de 401/403/429.',
        data: {
          windowMinutes: config.windowMinutes,
          deniedSpikeCountRecent: snapshot.deniedSpikeCountRecent,
          unauthorizedCountRecent: snapshot.unauthorizedCountRecent,
          forbiddenCountRecent: snapshot.forbiddenCountRecent,
          rateLimitedCountRecent: snapshot.rateLimitedCountRecent,
          threshold: config.deniedSpikeThreshold,
        },
      },
      nowMs,
      config.cooldownMinutes,
    );
  }

  private async evaluateJobFailureStormAlert(
    config: EvaluatorConfig,
    now: Date,
    nowMs: number,
  ): Promise<boolean> {
    const windowStart = new Date(now.getTime() - config.windowMinutes * 60 * 1000);
    const recentFailures = await this.prisma.backupJob.findMany({
      where: {
        status: BackupJobStatus.FAILED,
        finishedAt: {
          gte: windowStart,
        },
      },
      select: {
        id: true,
        type: true,
        finishedAt: true,
      },
      orderBy: [{ finishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 5,
    });

    if (recentFailures.length < config.jobFailureStormThreshold) {
      return false;
    }

    return this.emitAlertIfNeeded(
      {
        action: 'OPS_JOB_FAILURE_STORM',
        cooldownKey: 'OPS_JOB_FAILURE_STORM',
        severity: 'critical',
        title: 'Falhas repetidas em jobs',
        body: 'Multiplos jobs falharam em sequencia.',
        data: {
          windowMinutes: config.windowMinutes,
          failureCount: recentFailures.length,
          failures: recentFailures.map((failure) => ({
            id: failure.id,
            type: failure.type,
            finishedAt: failure.finishedAt?.toISOString() || null,
          })),
          threshold: config.jobFailureStormThreshold,
        },
        pushEligible: true,
        audit: true,
      },
      nowMs,
      config.cooldownMinutes,
    );
  }

  private async evaluateInfraAlerts(
    config: EvaluatorConfig,
    nowMs: number,
  ): Promise<{
    emitted: string[];
    skipped: string[];
  }> {
    const emitted: string[] = [];
    const skipped: string[] = [];
    const [databaseMetric, redisMetric] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
    ]);

    if (
      await this.evaluateInfraMetricAlert('database', databaseMetric, config, nowMs)
    ) {
      emitted.push('OPS_DATABASE_DEGRADED');
    } else {
      skipped.push('OPS_DATABASE_DEGRADED');
    }

    if (
      await this.evaluateInfraMetricAlert('redis', redisMetric, config, nowMs)
    ) {
      emitted.push('OPS_REDIS_DEGRADED');
    } else {
      skipped.push('OPS_REDIS_DEGRADED');
    }

    return { emitted, skipped };
  }

  private async evaluateInfraMetricAlert(
    serviceKey: InfraServiceKey,
    metric: InfraHealthMetric,
    config: EvaluatorConfig,
    nowMs: number,
  ): Promise<boolean> {
    if (!this.isInfraMetricDegraded(metric)) {
      this.infraDegradedCounts.set(serviceKey, 0);
      return false;
    }

    const nextCount = (this.infraDegradedCounts.get(serviceKey) || 0) + 1;
    this.infraDegradedCounts.set(serviceKey, nextCount);

    if (nextCount < config.infraDegradedMinConsecutive) {
      return false;
    }

    const isDatabase = serviceKey === 'database';
    return this.emitAlertIfNeeded(
      {
        action: isDatabase ? 'OPS_DATABASE_DEGRADED' : 'OPS_REDIS_DEGRADED',
        cooldownKey: isDatabase ? 'OPS_DATABASE_DEGRADED' : 'OPS_REDIS_DEGRADED',
        severity: 'critical',
        title: 'Servico degradado',
        body: `${isDatabase ? 'Banco de dados' : 'Redis'} apresentou degradacao persistente.`,
        data: {
          service: serviceKey,
          status: metric.status,
          latencyMs: metric.latencyMs,
          consecutiveChecks: nextCount,
          threshold: config.infraDegradedMinConsecutive,
        },
        pushEligible: true,
        audit: true,
      },
      nowMs,
      config.cooldownMinutes,
    );
  }

  private findCriticalSlowRoute(
    snapshot: ApiTelemetrySnapshot,
    config: EvaluatorConfig,
  ): RouteTelemetrySummary | null {
    return (
      snapshot.topSlowRoutes.find((route) => {
        const avgMs = Number(route.avgMs);
        return (
          route.requestCount >= config.minRouteSample &&
          Number.isFinite(avgMs) &&
          avgMs >= config.routeLatencyMsThreshold
        );
      }) || null
    );
  }

  private async emitAlertIfNeeded(
    input: AlertDispatchInput,
    nowMs: number,
    cooldownMinutes: number,
  ): Promise<boolean> {
    const cooldownUntil = this.cooldownState.get(input.cooldownKey) || 0;
    if (cooldownUntil > nowMs) {
      return false;
    }

    const notification = await this.notificationService.createSystemNotificationEntity({
      severity: input.severity,
      title: input.title,
      body: input.body,
      data: {
        alertAction: input.action,
        ...(input.data || {}),
      },
      targetRole: 'SUPER_ADMIN',
      type: 'SYSTEM_ALERT',
      module: 'operational-alerts',
      source: input.source || 'operational-alerts',
    });

    if (!notification) {
      return false;
    }

    const pushEnabled =
      Boolean(input.pushEligible) && Boolean(await this.pushNotificationService.getPublicKey());

    await this.notificationGateway.emitNewNotification(notification, {
      push: pushEnabled,
    });

    if (input.audit && input.severity === 'critical') {
      await this.auditService.log({
        action: input.action,
        severity: 'critical',
        message: input.body,
        metadata: {
          channel: pushEnabled ? 'inbox_push' : 'inbox_only',
          ...(input.data || {}),
        },
      });
    }

    this.cooldownState.set(input.cooldownKey, nowMs + cooldownMinutes * 60 * 1000);
    return true;
  }

  private isInfraMetricDegraded(metric: InfraHealthMetric): boolean {
    return metric.status === 'degraded' || metric.status === 'error' || metric.status === 'down';
  }

  private async checkDatabaseHealth(): Promise<InfraHealthMetric> {
    try {
      const startedAt = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      return {
        status: 'error',
        latencyMs: null,
      };
    }
  }

  private async checkRedisHealth(): Promise<InfraHealthMetric> {
    const host = String(process.env.REDIS_HOST || '').trim();
    const port = this.readIntFromEnv('REDIS_PORT', 6379, 1, 65535);
    const password = String(process.env.REDIS_PASSWORD || '').trim();
    const username = String(process.env.REDIS_USERNAME || '').trim();
    const db = this.readIntFromEnv('REDIS_DB', 0, 0, Number.MAX_SAFE_INTEGER);

    if (!host) {
      return {
        status: 'not_configured',
        latencyMs: null,
      };
    }

    const redis = new Redis({
      host,
      port,
      username: username || undefined,
      password: password || undefined,
      db,
      connectTimeout: 1500,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    try {
      const startedAt = Date.now();
      if (redis.status === 'wait') {
        await redis.connect();
      }
      const pong = await redis.ping();
      return {
        status: pong === 'PONG' ? 'healthy' : 'degraded',
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      return {
        status: 'down',
        latencyMs: null,
      };
    } finally {
      try {
        await redis.quit();
      } catch {
        redis.disconnect();
      }
    }
  }

  private getEvaluatorConfig(): EvaluatorConfig {
    return {
      windowMinutes: this.readIntFromEnv(
        'OPS_ALERT_WINDOW_MINUTES',
        DEFAULT_ALERT_WINDOW_MINUTES,
        1,
        60,
      ),
      cooldownMinutes: this.readIntFromEnv(
        'OPS_ALERT_COOLDOWN_MINUTES',
        DEFAULT_ALERT_COOLDOWN_MINUTES,
        1,
        24 * 60,
      ),
      rate5xxThreshold: this.readFloatFromEnv(
        'OPS_ALERT_5XX_RATE_THRESHOLD',
        DEFAULT_ALERT_5XX_RATE_THRESHOLD,
        0.1,
        100,
      ),
      minRequestSample: this.readIntFromEnv(
        'OPS_ALERT_MIN_REQUEST_SAMPLE',
        DEFAULT_ALERT_MIN_REQUEST_SAMPLE,
        1,
        100_000,
      ),
      routeLatencyMsThreshold: this.readIntFromEnv(
        'OPS_ALERT_ROUTE_LATENCY_MS_THRESHOLD',
        DEFAULT_ALERT_ROUTE_LATENCY_MS_THRESHOLD,
        1,
        60_000,
      ),
      minRouteSample: this.readIntFromEnv(
        'OPS_ALERT_MIN_ROUTE_SAMPLE',
        DEFAULT_ALERT_MIN_ROUTE_SAMPLE,
        1,
        100_000,
      ),
      deniedSpikeThreshold: this.readIntFromEnv(
        'OPS_ALERT_DENIED_SPIKE_THRESHOLD',
        DEFAULT_ALERT_DENIED_SPIKE_THRESHOLD,
        1,
        100_000,
      ),
      minDeniedSample: this.readIntFromEnv(
        'OPS_ALERT_MIN_DENIED_SAMPLE',
        DEFAULT_ALERT_MIN_DENIED_SAMPLE,
        1,
        100_000,
      ),
      jobFailureStormThreshold: this.readIntFromEnv(
        'OPS_ALERT_JOB_FAILURE_STORM_THRESHOLD',
        DEFAULT_ALERT_JOB_FAILURE_STORM_THRESHOLD,
        1,
        100_000,
      ),
      infraDegradedMinConsecutive: this.readIntFromEnv(
        'OPS_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE',
        DEFAULT_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE,
        1,
        100,
      ),
    };
  }

  private pruneCooldownState(nowMs: number): void {
    for (const [key, expiresAt] of this.cooldownState.entries()) {
      if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
        this.cooldownState.delete(key);
      }
    }
  }

  private readIntFromEnv(key: string, fallback: number, min: number, max: number): number {
    const raw = Number.parseInt(String(process.env[key] || ''), 10);
    if (!Number.isFinite(raw)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, raw));
  }

  private readFloatFromEnv(key: string, fallback: number, min: number, max: number): number {
    const raw = Number.parseFloat(String(process.env[key] || ''));
    if (!Number.isFinite(raw)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, Number(raw.toFixed(2))));
  }

  private async tryAcquireAdvisoryLock(): Promise<boolean> {
    if (!this.advisoryLockEnabled) {
      return true;
    }

    try {
      const result = await this.prisma.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_lock(${this.lockId}) AS acquired
      `;
      return result?.[0]?.acquired === true;
    } catch (error) {
      this.logger.warn(`Failed to acquire operational alerts advisory lock: ${String(error)}`);
      return false;
    }
  }

  private async releaseAdvisoryLock(): Promise<void> {
    if (!this.advisoryLockEnabled) {
      return;
    }

    try {
      await this.prisma.$executeRaw`SELECT pg_advisory_unlock(${this.lockId})`;
    } catch (error) {
      this.logger.warn(`Failed to release operational alerts advisory lock: ${String(error)}`);
    }
  }
}
