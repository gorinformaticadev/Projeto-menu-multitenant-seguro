import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Optional,
  NestInterceptor,
} from '@nestjs/common';
import { resolveApiRouteContractPolicy } from '@contracts/api-routes';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { OperationalObservabilityService } from '@common/services/operational-observability.service';
import { SystemTelemetryService } from '@common/services/system-telemetry.service';
import {
  resolveTelemetryRoute,
  shouldCollectRequestTelemetry,
} from '@common/services/system-telemetry.util';

@Injectable()
export class SystemTelemetryInterceptor implements NestInterceptor {
  constructor(
    private readonly systemTelemetryService: SystemTelemetryService,
    @Optional()
    private readonly operationalObservabilityService?: OperationalObservabilityService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<any>();
    const route = resolveTelemetryRoute(request);
    if (!shouldCollectRequestTelemetry(request?.method, route)) {
      return next.handle();
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          const statusCode = Number(request?.res?.statusCode || 200);
          this.systemTelemetryService.recordRequest({
            request,
            route,
            durationMs,
            statusCode,
          });
          this.recordSlowSuccessIfNeeded(request, route, durationMs, statusCode);
        },
        error: (error) => {
          const statusCode =
            typeof error?.getStatus === 'function'
              ? Number(error.getStatus())
              : Number(request?.res?.statusCode || 500);

          this.systemTelemetryService.recordRequest({
            request,
            route,
            durationMs: Date.now() - startedAt,
            statusCode,
          });
        },
      }),
    );
  }

  private recordSlowSuccessIfNeeded(
    request: Record<string, any>,
    route: string,
    durationMs: number,
    statusCode: number,
  ) {
    if (statusCode >= 500 || durationMs <= 0) {
      return;
    }

    const routePolicy = resolveApiRouteContractPolicy(route);
    const thresholdMs = Math.max(
      750,
      Math.floor(routePolicy.response.executionTimeoutMs * 0.7),
    );

    if (durationMs < thresholdMs) {
      return;
    }

    this.operationalObservabilityService?.record({
      type: 'slow_success',
      route,
      request,
      statusCode,
      severity: 'log',
      detail: `slow success route=${routePolicy.id} duration=${durationMs} threshold=${thresholdMs}`,
      extra: {
        routeId: routePolicy.id,
        durationMs,
        thresholdMs,
      },
    });
  }
}
