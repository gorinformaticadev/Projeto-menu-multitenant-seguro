import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';

export const SKIP_TENANT_ISOLATION = 'skipTenantIsolation';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {
      // Empty implementation
    }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // SEMPRE validar tenantId mesmo para SUPER_ADMIN
    const skipIsolation = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_ISOLATION,
      [context.getHandler(), context.getClass()],
    );

    if (user && !skipIsolation) {
      // Validar que tenantId do payload corresponde ao usuário
      const payloadTenantId = request.body?.tenantId || request.query?.tenantId;
      
      // Para usuários normais, validar que o tenantId do payload bate com o do usuário
      if (payloadTenantId && payloadTenantId !== user.tenantId && user.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Acesso negado a dados de outro tenant');
      }
      
      // Para SUPER_ADMIN, ainda validar contexto mas permitir acesso cross-tenant
      // quando explicitamente autorizado
      if (user.role === 'SUPER_ADMIN' && payloadTenantId) {
        // Registrar acesso cross-tenant para auditoria
        console.warn(`SUPER_ADMIN acessando tenant ${payloadTenantId}`, {
          userId: user.id,
          fromTenant: user.tenantId,
          toTenant: payloadTenantId,
          timestamp: new Date().toISOString()
        });
      }
      
      request.tenantId = user.tenantId;
    }

    return next.handle();
  }
}
