import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { BackupJobStatus } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { CronService } from '../../core/cron/cron.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationGateway } from '../../notifications/notification.gateway';
import { NotificationService, SystemNotificationSeverity } from '../../notifications/notification.service';
import { PushNotificationService } from '../../notifications/push-notification.service';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { DistributedOperationalStateService } from './distributed-operational-state.service';
import { OperationalLoadSheddingService } from './operational-load-shedding.service';
import {
  ApiTelemetrySnapshot,
  OperationalTelemetrySnapshot,
  RouteTelemetrySummary,
  SecurityTelemetrySnapshot,
  SystemTelemetryService,
} from './system-telemetry.service';
import { RedisLockService } from './redis-lock.service';

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
  versionFallbackThreshold: number;
  requestRetryStormThreshold: number;
  runtimePressureThreshold: number;
  queueSaturationThreshold: number;
  circuitInstabilityThreshold: number;
  correlatedOperationalRouteThreshold: number;
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
  detail?: string | null;
};

type CorrelatedOperationalRoute = {
  route: string;
  signalCount: number;
  signalFamilies: string[];
  runtimePressureEvents: number;
  queueSaturationEvents: number;
  circuitOpenEvents: number;
  requestRetryEvents: number;
  slowSuccessEvents: number;
  autoMitigationEvents: number;
};

const DEFAULT_ALERT_WINDOW_MINUTES = 5;
const DEFAULT_ALERT_COOLDOWN_MINUTES = 15;
const DEFAULT_ALERT_5XX_RATE_THRESHOLD = 10;
const DEFAULT_ALERT_MIN_REQUEST_SAMPLE = 25;
const DEFAULT_ALERT_ROUTE_LATENCY_MS_THRESHOLD = 1_500;
const DEFAULT_ALERT_MIN_ROUTE_SAMPLE = 8;
const DEFAULT_ALERT_DENIED_SPIKE_THRESHOLD = 15;
const DEFAULT_ALERT_MIN_DENIED_SAMPLE = 12;
const DEFAULT_ALERT_JOB_FAILURE_STORM_THRESHOLD = 4;
const DEFAULT_ALERT_INFRA_DEGRADED_MIN_CONSECUTIVE = 3;
const DEFAULT_ALERT_VERSION_FALLBACK_THRESHOLD = 5;
const DEFAULT_ALERT_REQUEST_RETRY_STORM_THRESHOLD = 10;
const DEFAULT_ALERT_RUNTIME_PRESSURE_THRESHOLD = 4;
const DEFAULT_ALERT_QUEUE_SATURATION_THRESHOLD = 4;
const DEFAULT_ALERT_CIRCUIT_INSTABILITY_THRESHOLD = 3;
const DEFAULT_ALERT_CORRELATED_OPERATIONAL_ROUTE_THRESHOLD = 4;
const DEFAULT_ALERT_FEATURE_MITIGATION_THRESHOLD = 2;

@Injectable()
export class SystemOperationalAlertsService implements OnModuleInit {
  private readonly logger = new Logger(SystemOperationalAlertsService.name);
  private operationalAlertsEnabled = true;
  private readonly infraDegradedCounts = new Map<InfraServiceKey, number>();
  private mitigationActiveCount = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemTelemetryService: SystemTelemetryService,
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
    private readonly pushNotificationService: PushNotificationService,
    private readonly auditService: AuditService,
    private readonly cronService: CronService,
    private readonly configResolver: ConfigResolverService,
    private readonly redisLock: RedisLockService,
    private readonly distributedOperationalStateService: DistributedOperationalStateService,
    private readonly operationalLoadSheddingService: OperationalLoadSheddingService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.cronService.register(
      'system.operational_alerts_evaluator',
      CronExpression.EVERY_MINUTE,
      async () => {
        await this.handleOperationalAlertsEvaluator();
      },
      {
        name: 'Operational alerts evaluator',
        description: 'Avalia telemetria e emite alertas operacionais automaticos.',
        settingsUrl: '/configuracoes/sistema/cron',
        origin: 'core',
        editable: true,
        watchdogEnabled: false,
      },
    );
  }

  async handleOperationalAlertsEvaluator(): Promise<void> {
    const instanceId = process.env.NODE_APP_INSTANCE || process.env.HOSTNAME || 'single-instance';
    const lockKey = 'alert:evaluator:lock';

    const lockState = await this.redisLock.acquireLockState(lockKey, 50000, instanceId);
    if (lockState === 'degraded') {
      this.logger.error(
        'Operational alerts evaluator skipped: Redis lock coordination is degraded.',
      );
      return;
    }

    if (lockState === 'busy') {
      this.logger.log('Operational alerts evaluator skipped: lock is held by another instance.');
      return;
    }

    try {
      await this.evaluateOperationalAlerts();
    } catch (error) {
      this.logger.error('Operational alerts evaluator failed.', error as Error);
    } finally {
      await this.redisLock.releaseLock(lockKey, instanceId);
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
    const operationalSnapshot = this.systemTelemetryService.getOperationalSnapshot(windowMs);
    const emitted: string[] = [];
    const skipped: string[] = [];

    // this.pruneCooldownState(nowMs); // Removed as cooldownState is replaced by RedisLockService

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

    const operationalAlerts = await this.evaluateOperationalSignalsAlerts(
      operationalSnapshot,
      config,
      nowMs,
    );
    emitted.push(...operationalAlerts.emitted);
    skipped.push(...operationalAlerts.skipped);

    const infraAlerts = await this.evaluateInfraAlerts(config, nowMs);
    emitted.push(...infraAlerts.emitted);
    skipped.push(...infraAlerts.skipped);

    if (await this.evaluateMitigationVisibilityAlert(config, nowMs)) {
      emitted.push('OPS_FEATURE_MITIGATION_ACTIVE');
    } else {
      skipped.push('OPS_FEATURE_MITIGATION_ACTIVE');
    }

    return { emitted, skipped };
  }

  // New method from instruction, assuming it's for infra alerts
  async evaluateInfraMetrics(): Promise<void> {
    const config = this.getEvaluatorConfig();
    const nowMs = Date.now();
    await this.evaluateInfraAlerts(config, nowMs);
  }

  async notifyMaintenanceBypassUsed(input: {
    method: string;
    route: string;
  }): Promise<boolean> {
    return this.dispatchOperationalAlert(
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
    );
  }

  async dispatchOperationalAlert(
    input: AlertDispatchInput,
    nowMs = Date.now(),
    cooldownMinutes = this.getEvaluatorConfig().cooldownMinutes,
  ): Promise<boolean> {
    return this.emitAlertIfNeeded(input, nowMs, cooldownMinutes);
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

  private async evaluateOperationalSignalsAlerts(
    snapshot: OperationalTelemetrySnapshot,
    config: EvaluatorConfig,
    nowMs: number,
  ): Promise<{
    emitted: string[];
    skipped: string[];
  }> {
    const emitted: string[] = [];
    const skipped: string[] = [];

    const versionFallbacks = this.getOperationalCount(snapshot, 'version_fallback');
    if (
      versionFallbacks >= config.versionFallbackThreshold &&
      (await this.emitAlertIfNeeded(
        {
          action: 'OPS_VERSION_FALLBACK_SPIKE',
          cooldownKey: 'OPS_VERSION_FALLBACK_SPIKE',
          severity: 'warning',
          title: 'Spike de fallback de contrato',
          body: 'A API esta respondendo com contratos legados acima do limite tolerado.',
          data: {
            windowMinutes: config.windowMinutes,
            versionFallbacks,
            threshold: config.versionFallbackThreshold,
          },
        },
        nowMs,
        config.cooldownMinutes,
      ))
    ) {
      emitted.push('OPS_VERSION_FALLBACK_SPIKE');
    } else {
      skipped.push('OPS_VERSION_FALLBACK_SPIKE');
    }

    const requestRetries = this.getOperationalCount(snapshot, 'request_retry');
    if (
      requestRetries >= config.requestRetryStormThreshold &&
      (await this.emitAlertIfNeeded(
        {
          action: 'OPS_REQUEST_RETRY_STORM',
          cooldownKey: 'OPS_REQUEST_RETRY_STORM',
          severity: 'warning',
          title: 'Tempestade de retries',
          body: 'O frontend/backend entrou em padrao de retry acima do esperado.',
          data: {
            windowMinutes: config.windowMinutes,
            requestRetries,
            threshold: config.requestRetryStormThreshold,
          },
        },
        nowMs,
        config.cooldownMinutes,
      ))
    ) {
      emitted.push('OPS_REQUEST_RETRY_STORM');
    } else {
      skipped.push('OPS_REQUEST_RETRY_STORM');
    }

    const runtimePressureEvents = this.getOperationalCount(snapshot, 'runtime_pressure');
    if (
      runtimePressureEvents >= config.runtimePressureThreshold &&
      (await this.emitAlertIfNeeded(
        {
          action: 'OPS_RUNTIME_PRESSURE_RECENT',
          cooldownKey: 'OPS_RUNTIME_PRESSURE_RECENT',
          severity: 'critical',
          title: 'Pressao de runtime recorrente',
          body: 'O backend esta descartando requisicoes por pressao de runtime.',
          data: {
            windowMinutes: config.windowMinutes,
            runtimePressureEvents,
            threshold: config.runtimePressureThreshold,
          },
          pushEligible: true,
          audit: true,
        },
        nowMs,
        config.cooldownMinutes,
      ))
    ) {
      emitted.push('OPS_RUNTIME_PRESSURE_RECENT');
    } else {
      skipped.push('OPS_RUNTIME_PRESSURE_RECENT');
    }

    const queueSaturationEvents =
      this.getOperationalCount(snapshot, 'request_queue_rejected') +
      this.getOperationalCount(snapshot, 'request_queue_timeout');
    if (
      queueSaturationEvents >= config.queueSaturationThreshold &&
      (await this.emitAlertIfNeeded(
        {
          action: 'OPS_QUEUE_SATURATION',
          cooldownKey: 'OPS_QUEUE_SATURATION',
          severity: 'warning',
          title: 'Fila de isolamento saturada',
          body: 'Operacoes pesadas estao esgotando a fila de isolamento.',
          data: {
            windowMinutes: config.windowMinutes,
            queueSaturationEvents,
            queueRejectedEvents: this.getOperationalCount(snapshot, 'request_queue_rejected'),
            queueTimeoutEvents: this.getOperationalCount(snapshot, 'request_queue_timeout'),
            threshold: config.queueSaturationThreshold,
          },
        },
        nowMs,
        config.cooldownMinutes,
      ))
    ) {
      emitted.push('OPS_QUEUE_SATURATION');
    } else {
      skipped.push('OPS_QUEUE_SATURATION');
    }

    const circuitOpenEvents = this.getOperationalCount(snapshot, 'circuit_open');
    if (
      circuitOpenEvents >= config.circuitInstabilityThreshold &&
      (await this.emitAlertIfNeeded(
        {
          action: 'OPS_CIRCUIT_BREAKER_INSTABILITY',
          cooldownKey: 'OPS_CIRCUIT_BREAKER_INSTABILITY',
          severity: 'critical',
          title: 'Circuit breaker instavel',
          body: 'Dependencias criticas estao abrindo circuit breaker repetidamente.',
          data: {
            windowMinutes: config.windowMinutes,
            circuitOpenEvents,
            circuitHalfOpenEvents: this.getOperationalCount(snapshot, 'circuit_half_open'),
            circuitRecoveredEvents: this.getOperationalCount(snapshot, 'circuit_recovered'),
            threshold: config.circuitInstabilityThreshold,
          },
          pushEligible: true,
          audit: true,
        },
        nowMs,
        config.cooldownMinutes,
      ))
    ) {
      emitted.push('OPS_CIRCUIT_BREAKER_INSTABILITY');
    } else {
      skipped.push('OPS_CIRCUIT_BREAKER_INSTABILITY');
    }

    const correlatedRoute = this.findCorrelatedOperationalRoute(snapshot, config);
    if (
      correlatedRoute &&
      (await this.emitAlertIfNeeded(
        {
          action: 'OPS_CORRELATED_OPERATIONAL_DEGRADATION',
          cooldownKey: `OPS_CORRELATED_OPERATIONAL_DEGRADATION:${correlatedRoute.route}`,
          severity: 'critical',
          title: 'Degradacao operacional correlacionada',
          body: `A rota ${correlatedRoute.route} acumula sinais de degradacao operacional no mesmo intervalo.`,
          data: {
            route: correlatedRoute.route,
            signalCount: correlatedRoute.signalCount,
            signalFamilies: correlatedRoute.signalFamilies,
            runtimePressureEvents: correlatedRoute.runtimePressureEvents,
            queueSaturationEvents: correlatedRoute.queueSaturationEvents,
            circuitOpenEvents: correlatedRoute.circuitOpenEvents,
            requestRetryEvents: correlatedRoute.requestRetryEvents,
            slowSuccessEvents: correlatedRoute.slowSuccessEvents,
            autoMitigationEvents: correlatedRoute.autoMitigationEvents,
            threshold: config.correlatedOperationalRouteThreshold,
          },
          pushEligible: true,
          audit: true,
        },
        nowMs,
        config.cooldownMinutes,
      ))
    ) {
      emitted.push(`OPS_CORRELATED_OPERATIONAL_DEGRADATION:${correlatedRoute.route}`);
    } else {
      skipped.push('OPS_CORRELATED_OPERATIONAL_DEGRADATION');
    }

    return { emitted, skipped };
  }

  private getOperationalCount(
    snapshot: OperationalTelemetrySnapshot,
    type: OperationalTelemetrySnapshot['byType'][number]['type'],
  ): number {
    return snapshot.byType.find((entry) => entry.type === type)?.count || 0;
  }

  private findCorrelatedOperationalRoute(
    snapshot: OperationalTelemetrySnapshot,
    config: EvaluatorConfig,
  ): CorrelatedOperationalRoute | null {
    const byRoute = new Map<string, CorrelatedOperationalRoute>();

    for (const event of snapshot.recent) {
      const route = String(event.route || '').trim();
      if (!route || route === '/') {
        continue;
      }

      const bucket =
        byRoute.get(route) ||
        ({
          route,
          signalCount: 0,
          signalFamilies: [],
          runtimePressureEvents: 0,
          queueSaturationEvents: 0,
          circuitOpenEvents: 0,
          requestRetryEvents: 0,
          slowSuccessEvents: 0,
          autoMitigationEvents: 0,
        } satisfies CorrelatedOperationalRoute);

      if (event.type === 'runtime_pressure') {
        bucket.runtimePressureEvents += 1;
      } else if (
        event.type === 'request_queue_rejected' ||
        event.type === 'request_queue_timeout'
      ) {
        bucket.queueSaturationEvents += 1;
      } else if (event.type === 'circuit_open') {
        bucket.circuitOpenEvents += 1;
      } else if (event.type === 'request_retry') {
        bucket.requestRetryEvents += 1;
      } else if (event.type === 'slow_success') {
        bucket.slowSuccessEvents += 1;
      } else if (event.type === 'auto_mitigation') {
        bucket.autoMitigationEvents += 1;
      } else {
        continue;
      }

      const signalFamilies = [
        bucket.runtimePressureEvents > 0 ? 'runtime_pressure' : null,
        bucket.queueSaturationEvents > 0 ? 'queue_saturation' : null,
        bucket.circuitOpenEvents > 0 ? 'circuit_open' : null,
        bucket.requestRetryEvents > 0 ? 'request_retry' : null,
        bucket.slowSuccessEvents > 0 ? 'slow_success' : null,
        bucket.autoMitigationEvents > 0 ? 'auto_mitigation' : null,
      ].filter(Boolean) as string[];

      bucket.signalFamilies = signalFamilies;
      bucket.signalCount =
        bucket.runtimePressureEvents +
        bucket.queueSaturationEvents +
        bucket.circuitOpenEvents +
        bucket.requestRetryEvents +
        bucket.slowSuccessEvents +
        bucket.autoMitigationEvents;
      byRoute.set(route, bucket);
    }

    const candidates = [...byRoute.values()]
      .filter(
        (entry) =>
          entry.signalCount >= config.correlatedOperationalRouteThreshold &&
          entry.signalFamilies.length >= 2,
      )
      .sort(
        (left, right) =>
          right.signalCount - left.signalCount ||
          right.signalFamilies.length - left.signalFamilies.length ||
          left.route.localeCompare(right.route),
      );

    return candidates[0] || null;
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

  private async evaluateMitigationVisibilityAlert(
    config: EvaluatorConfig,
    nowMs: number,
  ): Promise<boolean> {
    const snapshot = this.operationalLoadSheddingService.getSnapshot();
    const activeFlags = snapshot.mitigation.featureFlags;

    if (activeFlags.length === 0) {
      this.mitigationActiveCount = 0;
      return false;
    }

    this.mitigationActiveCount += 1;
    const threshold = this.readIntFromEnv(
      'OPS_ALERT_FEATURE_MITIGATION_THRESHOLD',
      DEFAULT_ALERT_FEATURE_MITIGATION_THRESHOLD,
      1,
      100,
    );

    if (this.mitigationActiveCount < threshold) {
      return false;
    }

    const redisHealth = this.distributedOperationalStateService.getHealth();
    return this.emitAlertIfNeeded(
      {
        action: 'OPS_FEATURE_MITIGATION_ACTIVE',
        cooldownKey: 'OPS_FEATURE_MITIGATION_ACTIVE',
        severity: snapshot.mitigation.rejectHeavyMutations ? 'critical' : 'warning',
        title: 'Mitigacao automatica ativa',
        body: 'O cluster desativou recursos ou endureceu limites para preservar disponibilidade.',
        data: {
          stateConsistency: snapshot.stateConsistency,
          adaptiveThrottleFactor: snapshot.adaptiveThrottleFactor,
          pressureCause: snapshot.pressureCause,
          featureFlags: activeFlags,
          businessImpact: snapshot.mitigation.businessImpact,
          overloadedInstances: snapshot.overloadedInstances,
          instanceCount: snapshot.instanceCount,
          redisTopologyMode: redisHealth.mode,
          redisFallbackActive: redisHealth.fallbackActive,
        },
        pushEligible: snapshot.mitigation.rejectHeavyMutations,
        audit: snapshot.mitigation.rejectHeavyMutations,
      },
      nowMs,
      config.cooldownMinutes,
    );
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
          detail: metric.detail || null,
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
    if (!this.operationalAlertsEnabled) {
      return false;
    }

    const cooldownKey = `alert:cooldown:${input.cooldownKey}`;
    const hasCooldown = await this.redisLock.hasCooldown(cooldownKey);

    if (hasCooldown) {
      return false;
    }

    const alertsEnabled =
      (await this.configResolver.getBoolean('operations.alerts.enabled')) !== false;
    if (!alertsEnabled) {
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

    await this.redisLock.setCooldown(cooldownKey, cooldownMinutes * 60 * 1000);

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
    const health = this.distributedOperationalStateService.getHealth();
    if (!this.isRedisMonitoringRequired() && !health.required) {
      return {
        status: 'not_configured',
        latencyMs: null,
        detail: health.detail || null,
      };
    }

    if (!health.enabled) {
      return {
        status: 'not_configured',
        latencyMs: null,
        detail: health.detail || null,
      };
    }

    if (health.ready && !health.fallbackActive) {
      return {
        status: 'healthy',
        latencyMs: null,
        detail: health.detail || null,
      };
    }

    return {
      status: health.fallbackActive ? 'degraded' : 'down',
      latencyMs: null,
      detail: health.detail || null,
    };
  }

  private isRedisMonitoringRequired(): boolean {
    const explicitFlag = String(process.env.OPS_ALERT_REDIS_REQUIRED || '').trim().toLowerCase();
    if (explicitFlag === 'true') {
      return true;
    }

    if (explicitFlag === 'false') {
      return false;
    }

    return false;
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
      versionFallbackThreshold: this.readIntFromEnv(
        'OPS_ALERT_VERSION_FALLBACK_THRESHOLD',
        DEFAULT_ALERT_VERSION_FALLBACK_THRESHOLD,
        1,
        10_000,
      ),
      requestRetryStormThreshold: this.readIntFromEnv(
        'OPS_ALERT_REQUEST_RETRY_STORM_THRESHOLD',
        DEFAULT_ALERT_REQUEST_RETRY_STORM_THRESHOLD,
        1,
        10_000,
      ),
      runtimePressureThreshold: this.readIntFromEnv(
        'OPS_ALERT_RUNTIME_PRESSURE_THRESHOLD',
        DEFAULT_ALERT_RUNTIME_PRESSURE_THRESHOLD,
        1,
        10_000,
      ),
      queueSaturationThreshold: this.readIntFromEnv(
        'OPS_ALERT_QUEUE_SATURATION_THRESHOLD',
        DEFAULT_ALERT_QUEUE_SATURATION_THRESHOLD,
        1,
        10_000,
      ),
      circuitInstabilityThreshold: this.readIntFromEnv(
        'OPS_ALERT_CIRCUIT_INSTABILITY_THRESHOLD',
        DEFAULT_ALERT_CIRCUIT_INSTABILITY_THRESHOLD,
        1,
        10_000,
      ),
      correlatedOperationalRouteThreshold: this.readIntFromEnv(
        'OPS_ALERT_CORRELATED_OPERATIONAL_ROUTE_THRESHOLD',
        DEFAULT_ALERT_CORRELATED_OPERATIONAL_ROUTE_THRESHOLD,
        2,
        10_000,
      ),
    };
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
}
