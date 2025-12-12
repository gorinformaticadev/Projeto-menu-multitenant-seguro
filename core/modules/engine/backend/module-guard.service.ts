import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { TenantModuleService } from './tenant-module.service';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private tenantModuleService: TenantModuleService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Se for SUPER_ADMIN, permitir acesso a tudo
    if (user && user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Extrair nome do módulo da rota
    const moduleName = this.extractModuleNameFromRoute(request.route.path);
    
    // Verificar se o módulo está ativo para o tenant do usuário
    if (user && user.tenantId && moduleName) {
      return await this.tenantModuleService.isModuleActiveForTenant(moduleName, user.tenantId);
    }

    return false;
  }

  private extractModuleNameFromRoute(routePath: string): string | null {
    // Extrair o nome do módulo do caminho da rota
    // Por exemplo: /api/modules/os/... -> "os"
    const match = routePath.match(/\/api\/modules\/([^\/]+)/);
    return match ? match[1] : null;
  }
}