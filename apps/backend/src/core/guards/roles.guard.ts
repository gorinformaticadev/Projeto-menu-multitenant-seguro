import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@core/decorators/roles.decorator';
import { SystemTelemetryService } from '@common/services/system-telemetry.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly systemTelemetryService: SystemTelemetryService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();

    if (!requiredRoles || requiredRoles.length === 0) {
      this.recordForbidden(request);
      throw new ForbiddenException('Acesso negado - permissoes nao definidas');
    }

    const { user } = request;

    if (!user) {
      this.recordForbidden(request);
      throw new ForbiddenException('Usuario nao autenticado');
    }

    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      this.recordForbidden(request);
      throw new ForbiddenException(`Permissao insuficiente. Requer: ${requiredRoles.join(', ')}`);
    }

    return true;
  }

  private recordForbidden(request: Record<string, any>) {
    this.systemTelemetryService.recordSecurityEvent({
      type: 'forbidden',
      request,
      statusCode: 403,
    });
  }
}
