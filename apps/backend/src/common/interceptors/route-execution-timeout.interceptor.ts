import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { resolveApiRouteContractPolicy } from '@contracts/api-routes';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class RouteExecutionTimeoutInterceptor implements NestInterceptor {
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

    return next.handle().pipe(
      timeout({
        first: routePolicy.response.executionTimeoutMs,
      }),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
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
}
