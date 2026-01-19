import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@core/decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

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
      console.warn('RolesGuard: Usuário não encontrado no request (não autenticado).');
      throw new ForbiddenException('Usuário não autenticado');
    }

    console.log(`RolesGuard Debug: User Email: ${user.email}, User Role: ${user.role}, Required Roles: ${JSON.stringify(requiredRoles)}`);

    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      console.warn(`RolesGuard: Acesso negado. Usuário: ${user.role}, Exigido: ${requiredRoles.join(', ')}`);
      throw new ForbiddenException(`Permissão insuficiente. Requer: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
