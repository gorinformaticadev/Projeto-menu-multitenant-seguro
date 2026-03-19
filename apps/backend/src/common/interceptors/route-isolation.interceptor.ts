import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { resolveApiRouteContractPolicy } from '@contracts/api-routes';
import type { Request } from 'express';
import { from, type Observable } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { OperationalRequestQueueService } from '../services/operational-request-queue.service';

@Injectable()
export class RouteIsolationInterceptor implements NestInterceptor {
  constructor(
    private readonly operationalRequestQueueService: OperationalRequestQueueService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const route = String(request?.originalUrl || request?.url || request?.path || '/');
    const routePolicy = resolveApiRouteContractPolicy(route);

    if (!routePolicy.runtime.queueIsolationRequired) {
      return next.handle();
    }

    return from(
      this.operationalRequestQueueService.run(
        {
          route,
          routePolicyId: routePolicy.id,
          runtime: routePolicy.runtime,
          request: request as unknown as Record<string, any>,
        },
        async () => lastValueFrom(next.handle()),
      ),
    );
  }
}
