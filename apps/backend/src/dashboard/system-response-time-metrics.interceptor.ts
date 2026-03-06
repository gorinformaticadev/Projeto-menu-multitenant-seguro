import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  ResponseMetricCategory,
  ResponseTimeMetricsService,
} from './system-response-time-metrics.service';

const EXCLUDED_SYSTEM_PATHS = [
  '/api/system/dashboard',
  '/api/system/dashboard/layout',
  '/api/system/maintenance/state',
  '/api/system/notifications',
  '/api/system/notifications/unread-count',
  '/api/system/notifications/stream',
  '/api/system/update/status',
  '/api/system/update/log',
  '/api/system/version',
  '/api/system/metrics',
];

@Injectable()
export class ResponseTimeMetricsInterceptor implements NestInterceptor {
  constructor(private readonly responseTimeMetricsService: ResponseTimeMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<any>();
    const method = String(request?.method || 'GET').trim().toUpperCase();
    if (method === 'OPTIONS') {
      return next.handle();
    }

    const requestPath = this.normalizePath(request);
    const category = this.resolveCategory(requestPath);
    if (!category) {
      return next.handle();
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.responseTimeMetricsService.record(Date.now() - startedAt, category);
        },
        error: () => {
          this.responseTimeMetricsService.record(Date.now() - startedAt, category);
        },
      }),
    );
  }

  private resolveCategory(requestPath: string): ResponseMetricCategory | null {
    if (!this.matchesPath(requestPath, '/api')) {
      return null;
    }

    if (EXCLUDED_SYSTEM_PATHS.some((path) => this.matchesPath(requestPath, path))) {
      return null;
    }

    if (this.matchesPath(requestPath, '/api/health')) {
      return 'health';
    }

    if (this.matchesPath(requestPath, '/api/system')) {
      return 'system';
    }

    return 'business';
  }

  private normalizePath(request: any): string {
    const rawPath = String(request?.originalUrl || request?.url || request?.path || '/');
    const [pathWithoutQuery] = rawPath.split('?');
    const normalized = pathWithoutQuery.trim().toLowerCase();
    return normalized || '/';
  }

  private matchesPath(actualPath: string, expectedBasePath: string): boolean {
    return actualPath === expectedBasePath || actualPath.startsWith(`${expectedBasePath}/`);
  }
}
