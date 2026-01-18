import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ModuleSecurityService } from './module-security.service';
import { CurrentUser } from './decorators/current-user.decorator';

/**
 * Controller para API de módulos do usuário
 * Endpoint: /api/me/modules
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class UserModulesController {
    constructor(private readonly moduleSecurity: ModuleSecurityService) { }

    /**
     * GET /api/me/modules
     * Retorna módulos disponíveis para o usuário atual
     */
    @Get('modules')
    async getMyModules(
        @CurrentUser() user: any,
        @Req() req: any) {
        const tenantId = req.tenantId || user.tenantId;

        if (!tenantId) {
            return { modules: [] };
        }

        const modules = await this.moduleSecurity.getAvailableModules(tenantId);

        return { modules };
    }
}