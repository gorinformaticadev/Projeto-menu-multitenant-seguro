import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { SystemTelemetryService } from '@common/services/system-telemetry.service';

export const SKIP_TENANT_ISOLATION = 'skipTenantIsolation';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private readonly systemTelemetryService: SystemTelemetryService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const skipIsolation = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_ISOLATION,
      [context.getHandler(), context.getClass()],
    );

    if (user && !skipIsolation) {
      const payloadTenantId =
        request.body?.tenantId || request.query?.tenantId || request.params?.tenantId;

      if (payloadTenantId && payloadTenantId !== user.tenantId && user.role !== 'SUPER_ADMIN') {
        this.systemTelemetryService.recordSecurityEvent({
          type: 'forbidden',
          request,
          statusCode: 403,
        });
        throw new ForbiddenException('Acesso negado a dados de outro tenant');
      }

      if (user.role === 'SUPER_ADMIN' && payloadTenantId) {
        console.warn(`SUPER_ADMIN acessando tenant ${payloadTenantId}`, {
          userId: user.id,
          fromTenant: user.tenantId,
          toTenant: payloadTenantId,
          timestamp: new Date().toISOString(),
        });
      }

      request.tenantId = user.tenantId;
    }

    return next.handle();
  }
}
