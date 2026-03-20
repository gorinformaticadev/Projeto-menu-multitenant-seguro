import { Injectable, Logger } from '@nestjs/common';
import { SystemTelemetryService, type OperationalTelemetryEventType } from './system-telemetry.service';
import { getRequestTrace } from '../http/request-trace.util';

type ObservabilitySeverity = 'log' | 'warn' | 'error';

type OperationalEventInput = {
  type: OperationalTelemetryEventType;
  route: string;
  request?: Record<string, any>;
  method?: string;
  statusCode?: number;
  detail?: string | null;
  severity?: ObservabilitySeverity;
  extra?: Record<string, unknown>;
};

@Injectable()
export class OperationalObservabilityService {
  private readonly logger = new Logger(OperationalObservabilityService.name);

  constructor(private readonly systemTelemetryService: SystemTelemetryService) {}

  record(input: OperationalEventInput): void {
    const requestTrace = getRequestTrace(input.request);
    const payload = {
      event: 'operational-observability',
      type: input.type,
      route: input.route,
      method: String(input.method || input.request?.method || 'UNKNOWN').toUpperCase(),
      statusCode: this.normalizeStatusCode(input.statusCode),
      requestId: requestTrace?.requestId || null,
      traceId: requestTrace?.traceId || null,
      tenantId: requestTrace?.tenantId || null,
      userId: requestTrace?.userId || null,
      apiVersion: requestTrace?.apiVersion || null,
      mitigationFlags: requestTrace?.mitigationFlags || [],
      detail: this.normalizeDetail(input.detail),
      ...(input.extra || {}),
    };

    const serialized = JSON.stringify(payload);
    if (input.severity === 'error') {
      this.logger.error(serialized);
    } else if (input.severity === 'warn') {
      this.logger.warn(serialized);
    } else {
      this.logger.log(serialized);
    }

    this.systemTelemetryService.recordOperationalEvent({
      type: input.type,
      request: input.request,
      route: input.route,
      method: payload.method,
      statusCode: payload.statusCode,
      requestId: payload.requestId || undefined,
      traceId: payload.traceId || undefined,
      tenantId: payload.tenantId || undefined,
      userId: payload.userId || undefined,
      apiVersion: payload.apiVersion || undefined,
      mitigationFlags: Array.isArray(payload.mitigationFlags) ? payload.mitigationFlags : undefined,
      detail: payload.detail,
    });
  }

  private normalizeStatusCode(statusCode?: number): number | null {
    const normalized = Number(statusCode);
    return Number.isFinite(normalized) && normalized >= 100 && normalized <= 599
      ? Math.floor(normalized)
      : null;
  }

  private normalizeDetail(detail?: string | null): string | null {
    const normalized = String(detail || '').trim();
    if (!normalized) {
      return null;
    }

    return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
  }
}
