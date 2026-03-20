import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RedisLockService } from '@common/services/redis-lock.service';
import {
  buildOutgoingTraceHeaders,
  getRequestTrace,
  getTraceBaggageBytes,
} from '@common/http/request-trace.util';
import {
  CircuitBreakerOpenError,
  OperationalCircuitBreakerService,
} from '@common/services/operational-circuit-breaker.service';
import {
  OperationalLoadSheddingService,
} from '@common/services/operational-load-shedding.service';
import {
  OperationalRequestQueueService,
} from '@common/services/operational-request-queue.service';
import { DistributedOperationalStateService } from '@common/services/distributed-operational-state.service';
import { SystemOperationalAlertsService } from '@common/services/system-operational-alerts.service';
import { SystemTelemetryService } from '@common/services/system-telemetry.service';

type RequestWithUser = Record<string, any> & {
  user?: {
    id?: string;
    sub?: string;
    tenantId?: string | null;
    role?: string;
  };
};

type DependencyCheckResult = {
  ok: boolean;
  statusCode: number;
  mode: 'ok' | 'failure' | 'circuit-open';
  instanceId: string;
  durationMs: number;
  tenantId: string | null;
  trace: ReturnType<OpsRuntimeTestService['buildTraceSummary']>;
  breaker: ReturnType<OperationalCircuitBreakerService['getSnapshot']>;
  dependency?: {
    url: string;
    status: number;
    body: unknown;
    traceHeaders: Record<string, string>;
  };
  error?: {
    message: string;
    retryAfterMs?: number;
  };
};

@Injectable()
export class OpsRuntimeTestService {
  private readonly instanceId =
    process.env.NODE_APP_INSTANCE || process.env.HOSTNAME || `instance-${process.pid}`;

  constructor(
    private readonly distributedOperationalStateService: DistributedOperationalStateService,
    private readonly redisLockService: RedisLockService,
    private readonly operationalRequestQueueService: OperationalRequestQueueService,
    private readonly operationalLoadSheddingService: OperationalLoadSheddingService,
    private readonly operationalCircuitBreakerService: OperationalCircuitBreakerService,
    private readonly systemTelemetryService: SystemTelemetryService,
    private readonly systemOperationalAlertsService: SystemOperationalAlertsService,
  ) {}

  async getClusterHealth(request: RequestWithUser) {
    return {
      instanceId: this.instanceId,
      tenantId: this.normalizeTenantId(request),
      trace: this.buildTraceSummary(request),
      redis: {
        distributedState: this.distributedOperationalStateService.getHealth(),
        lock: await this.redisLockService.getHealth(),
      },
      queue: {
        snapshot: this.operationalRequestQueueService.getSnapshot(),
        fairQueue: await this.operationalRequestQueueService.getRouteDebugState(
          'ops-runtime-test-fair-queue',
        ),
      },
      loadShedding: this.operationalLoadSheddingService.getSnapshot(),
      breaker: {
        dependency: this.operationalCircuitBreakerService.getSnapshot('dependency:ops-runtime-test'),
      },
      telemetry: {
        api: this.systemTelemetryService.getApiSnapshot(15 * 60 * 1000, 10),
        operational: this.systemTelemetryService.getOperationalSnapshot(15 * 60 * 1000, 20),
      },
    };
  }

  async holdFairQueue(request: RequestWithUser, holdMs: number) {
    const normalizedHoldMs = this.normalizeDelay(holdMs, 100, 20_000);
    const startedAt = Date.now();
    await this.sleep(normalizedHoldMs);
    return this.buildRuntimeResponse(request, startedAt, normalizedHoldMs, 'fair-queue-hold');
  }

  async slowSuccess(request: RequestWithUser, delayMs: number) {
    const normalizedDelayMs = this.normalizeDelay(delayMs, 250, 20_000);
    const startedAt = Date.now();
    await this.sleep(normalizedDelayMs);
    return this.buildRuntimeResponse(request, startedAt, normalizedDelayMs, 'slow-success');
  }

  async getAdaptiveContext(request: RequestWithUser, path: string | undefined) {
    const normalizedPath =
      typeof path === 'string' && path.trim().length > 0
        ? path.trim()
        : '/api/ops-runtime-test/runtime/slow';
    const tenantId = this.normalizeTenantId(request);
    const adaptive = await this.operationalLoadSheddingService.resolveAdaptiveRateLimitContext(
      normalizedPath,
      tenantId,
    );

    return {
      instanceId: this.instanceId,
      tenantId,
      path: normalizedPath,
      trace: this.buildTraceSummary(request),
      ...adaptive,
      snapshot: this.operationalLoadSheddingService.getSnapshot(),
    };
  }

  async evaluateAlerts() {
    const result = await this.systemOperationalAlertsService.evaluateOperationalAlerts();
    return {
      instanceId: this.instanceId,
      ...result,
    };
  }

  async checkDependency(
    request: RequestWithUser,
    timeoutMs: number,
  ): Promise<DependencyCheckResult> {
    const normalizedTimeoutMs = this.normalizeDelay(timeoutMs, 500, 10_000);
    const startedAt = Date.now();
    const url =
      process.env.OPS_RUNTIME_TEST_DEPENDENCY_URL || 'http://127.0.0.1:4600/dependency';

    try {
      const dependency = await this.operationalCircuitBreakerService.execute(
        {
          key: 'dependency:ops-runtime-test',
          route: '/ops-runtime-test/dependency/check',
          request,
          failureThreshold: 2,
          failureWindowMs: 8_000,
          resetTimeoutMs: 4_000,
          failureQuorum: 2,
          recoveryQuorum: 2,
          halfOpenMaxProbes: 2,
          halfOpenSuccessThreshold: 2,
          jitterRatio: 0.15,
        },
        async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), normalizedTimeoutMs);

          try {
            const traceHeaders = buildOutgoingTraceHeaders(request as any);
            const response = await fetch(url, {
              method: 'GET',
              headers: traceHeaders,
              signal: controller.signal,
            });
            const rawBody = await response.text();
            const body = this.safeJsonParse(rawBody);

            if (!response.ok) {
              throw new BadGatewayException({
                message: `Dependencia de teste respondeu ${response.status}`,
                dependencyStatus: response.status,
                dependencyBody: body,
              });
            }

            return {
              url,
              status: response.status,
              body,
              traceHeaders,
            };
          } finally {
            clearTimeout(timer);
          }
        },
      );

      return {
        ok: true,
        statusCode: 200,
        mode: 'ok',
        instanceId: this.instanceId,
        durationMs: Date.now() - startedAt,
        tenantId: this.normalizeTenantId(request),
        trace: this.buildTraceSummary(request),
        breaker: this.operationalCircuitBreakerService.getSnapshot('dependency:ops-runtime-test'),
        dependency,
      };
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        return {
          ok: false,
          statusCode: 503,
          mode: 'circuit-open',
          instanceId: this.instanceId,
          durationMs: Date.now() - startedAt,
          tenantId: this.normalizeTenantId(request),
          trace: this.buildTraceSummary(request),
          breaker: this.operationalCircuitBreakerService.getSnapshot('dependency:ops-runtime-test'),
          error: {
            message: error.message,
            retryAfterMs: error.retryAfterMs,
          },
        };
      }

      const message =
        error instanceof Error ? error.message : 'Falha desconhecida na dependencia de teste';
      return {
        ok: false,
        statusCode: 502,
        mode: 'failure',
        instanceId: this.instanceId,
        durationMs: Date.now() - startedAt,
        tenantId: this.normalizeTenantId(request),
        trace: this.buildTraceSummary(request),
        breaker: this.operationalCircuitBreakerService.getSnapshot('dependency:ops-runtime-test'),
        error: {
          message,
        },
      };
    }
  }

  private buildRuntimeResponse(
    request: RequestWithUser,
    startedAtMs: number,
    configuredDelayMs: number,
    operation: string,
  ) {
    const completedAtMs = Date.now();
    return {
      ok: true,
      operation,
      instanceId: this.instanceId,
      tenantId: this.normalizeTenantId(request),
      userId: this.normalizeUserId(request),
      configuredDelayMs,
      startedAt: new Date(startedAtMs).toISOString(),
      completedAt: new Date(completedAtMs).toISOString(),
      durationMs: completedAtMs - startedAtMs,
      trace: this.buildTraceSummary(request),
    };
  }

  private buildTraceSummary(request: RequestWithUser) {
    const trace = getRequestTrace(request as any);
    return {
      requestId: trace?.requestId || null,
      traceId: trace?.traceId || null,
      apiVersion: trace?.apiVersion || null,
      mitigationFlags: [...(trace?.mitigationFlags || [])],
      baggageBytes: getTraceBaggageBytes(trace),
    };
  }

  private normalizeTenantId(request: RequestWithUser) {
    const raw = request?.user?.tenantId || request?.tenantId || null;
    const normalized = String(raw || '').trim().toLowerCase();
    return normalized || null;
  }

  private normalizeUserId(request: RequestWithUser) {
    const raw = request?.user?.id || request?.user?.sub || null;
    const normalized = String(raw || '').trim().toLowerCase();
    return normalized || null;
  }

  private normalizeDelay(value: number, fallback: number, max: number) {
    const parsed = Number.isFinite(value) ? value : Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.max(50, Math.min(max, Math.floor(parsed)));
  }

  private safeJsonParse(rawBody: string): unknown {
    if (!rawBody) {
      return null;
    }

    try {
      return JSON.parse(rawBody);
    } catch {
      return {
        rawBody,
      };
    }
  }

  private async sleep(delayMs: number) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
