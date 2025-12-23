import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';

export const SKIP_TENANT_ISOLATION = 'skipTenantIsolation';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Verifica se a rota deve pular o isolamento (ex: rotas de SUPER_ADMIN)
    const skipIsolation = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_ISOLATION,
      [context.getHandler(), context.getClass()],
    );

    // Se o usuário está autenticado e não é SUPER_ADMIN, injeta o tenantId
    if (user && user.role !== 'SUPER_ADMIN' && !skipIsolation) {
      request.tenantId = user.tenantId;
    }

    return next.handle();
  }
}
