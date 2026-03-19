import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Optional,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { resolveApiRouteContractPolicy } from '@contracts/api-routes';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { OperationalObservabilityService } from '../services/operational-observability.service';
import { OperationalLoadSheddingService } from '../services/operational-load-shedding.service';

@Injectable()
export class RouteExecutionTimeoutInterceptor implements NestInterceptor {
  constructor(
    private readonly operationalObservabilityService?: OperationalObservabilityService,
    @Optional()
    private readonly operationalLoadSheddingService?: OperationalLoadSheddingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<{
      originalUrl?: string;
      url?: string;
      path?: string;
    }>();
    const routePolicy = resolveApiRouteContractPolicy(
      request?.originalUrl || request?.url || request?.path || '/',
    );
    const adaptiveTimeoutMs = this.resolveAdaptiveTimeoutMs(routePolicy.response.executionTimeoutMs, routePolicy.id);

    return next.handle().pipe(
      timeout({
        first: adaptiveTimeoutMs,
      }),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          this.operationalObservabilityService?.record({
            type: 'request_timeout',
            route: request?.originalUrl || request?.url || request?.path || '/',
            request: request as Record<string, any>,
            statusCode: 408,
            severity: 'warn',
            detail: `handler execution exceeded ${adaptiveTimeoutMs}ms for ${routePolicy.id}`,
            extra: {
              routeId: routePolicy.id,
              executionTimeoutMs: adaptiveTimeoutMs,
              configuredExecutionTimeoutMs: routePolicy.response.executionTimeoutMs,
            },
          });
          return throwError(
            () =>
              new RequestTimeoutException(
                `Execucao da rota excedeu o tempo limite configurado para ${routePolicy.id}.`,
              ),
          );
        }

        return throwError(() => error);
      }),
    );
  }

  private resolveAdaptiveTimeoutMs(baseTimeoutMs: number, routeId: string): number {
    const normalizedBaseTimeoutMs = Math.max(1_000, Math.floor(baseTimeoutMs));
    const snapshot = this.operationalLoadSheddingService?.getSnapshot();
    if (!snapshot) {
      return normalizedBaseTimeoutMs;
    }

    const adaptiveFactor =
      Number.isFinite(snapshot.adaptiveThrottleFactor) && snapshot.adaptiveThrottleFactor > 0
        ? snapshot.adaptiveThrottleFactor
        : 1;

    if (adaptiveFactor >= 1 && (snapshot.clusterRecentApiLatencyMs || 0) < normalizedBaseTimeoutMs * 0.5) {
      return normalizedBaseTimeoutMs;
    }

    const latencyPenalty =
      snapshot.clusterRecentApiLatencyMs && snapshot.clusterRecentApiLatencyMs >= normalizedBaseTimeoutMs * 0.75
        ? 0.15
        : 0;
    const compressedFactor = Math.max(0.4, Math.min(1, adaptiveFactor - latencyPenalty));
    return Math.max(1_500, Math.floor(normalizedBaseTimeoutMs * compressedFactor));
  }
}
