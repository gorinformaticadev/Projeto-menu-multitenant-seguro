import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@core/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '@core/common/decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // POLÍTICA DE SEGURANÇA: Negar por padrão se não especificado
    if (!requiredRoles || requiredRoles.length === 0) {
      // Se não tem roles definidos, mas não é público, talvez devêssemos checar apenas se está logado?
      // Mas a política atual lança erro. Vamos manter isso por enquanto, mas permitir pass-through se não houver roles
      // e o JwtAuthGuard já tiver validado?
      // Neste código legado, parece que ele EXIGE roles. 
      // Se a rota for protegida APENAS por login, deve ter um Role 'any'? Ou o RolesGuard não deveria estar lá.
      // Vou manter a lógica estrita mas adicionar o bypass de Public.
      throw new ForbiddenException('Acesso negado - permissões não definidas');
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(`Permissão insuficiente. Requer: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
