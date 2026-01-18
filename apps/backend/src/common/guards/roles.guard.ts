 import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@core/decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {
      // Empty implementation
    }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // POLÍTICA DE SEGURANÇA: Negar por padrão se não especificado
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException('Acesso negado - permissões não definidas');
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('UsuÃ¡rio nÃ£o autenticado');
    }

    const hasRole = requiredRoles.some((role) => user.role === role);
    
    if (!hasRole) {
      throw new ForbiddenException(`Permissão insuficiente. Requer: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}

