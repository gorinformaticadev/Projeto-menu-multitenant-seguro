import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SystemTelemetryService } from '@common/services/system-telemetry.service';
import {
  resolveTelemetryRoute,
  shouldCollectRequestTelemetry,
} from '@common/services/system-telemetry.util';

@Injectable()
export class SystemTelemetryInterceptor implements NestInterceptor {
  constructor(private readonly systemTelemetryService: SystemTelemetryService) {}

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
          this.systemTelemetryService.recordRequest({
            request,
            route,
            durationMs: Date.now() - startedAt,
            statusCode: Number(request?.res?.statusCode || 200),
          });
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
}
