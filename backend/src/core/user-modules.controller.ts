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
    constructor(private readonly moduleSecurity: ModuleSecurityService) {
        console.log('🔧 UserModulesController inicializado');
    }

    /**
     * GET /api/me/modules
     * Retorna módulos disponíveis para o usuário atual
     */
    @Get('modules')
    async getMyModules(
        @CurrentUser() user: any,
        @Req() req: any
    ) {
        console.log('📡 GET /me/modules chamado');

        const tenantId = req.tenantId || user.tenantId;

        if (!tenantId) {
            console.log('⚠️ Nenhum tenantId encontrado');
            return { modules: [] };
        }

        console.log(`🔍 Buscando módulos para tenant: ${tenantId}`);
        const modules = await this.moduleSecurity.getAvailableModules(tenantId);

        console.log(`✅ Retornando ${modules.length} módulos`);
        return { modules };
    }
}