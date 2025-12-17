import {
    Controller,
    Post,
    Get,
    Delete,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    Body,
    Param,
    BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ModuleInstallerService } from './module-installer.service';
import { memoryStorage } from 'multer';

/**
 * Controller para instalação e gerenciamento de módulos
 * Interface: /configuracoes/sistema/modulos
 */
@Controller('configuracoes/sistema/modulos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class ModuleInstallerController {
    constructor(private readonly installer: ModuleInstallerService) { }

    /**
     * GET /configuracoes/sistema/modulos
     * Lista módulos instalados e disponíveis
     */
    @Get()
    async listModules() {
        return await this.installer.listModules();
    }

    /**
     * POST /configuracoes/sistema/modulos/upload
     * Faz upload e instala um módulo .zip
     */
    @Post('upload')
    @UseInterceptors(FileInterceptor('file', {
        storage: memoryStorage(),
        limits: {
            fileSize: 50 * 1024 * 1024 // 50MB
        },
        fileFilter: (req, file, cb) => {
            if (!file.originalname.endsWith('.zip')) {
                return cb(new Error('Apenas arquivos .zip são permitidos'), false);
            }
            cb(null, true);
        }
    }))
    async uploadModule(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('Arquivo não fornecido');
        }

        if (!file.buffer) {
            throw new BadRequestException('Buffer do arquivo não encontrado');
        }

        return await this.installer.installModuleFromZip(file);
    }

    /**
     * POST /configuracoes/sistema/modulos/:slug/activate
     * Ativa um módulo instalado
     */
    @Post(':slug/activate')
    async activateModule(@Param('slug') slug: string) {
        return await this.installer.activateModule(slug);
    }

    /**
     * POST /configuracoes/sistema/modulos/:slug/deactivate
     * Desativa um módulo
     */
    @Post(':slug/deactivate')
    async deactivateModule(@Param('slug') slug: string) {
        return await this.installer.deactivateModule(slug);
    }

    /**
     * POST /configuracoes/sistema/modulos/:slug/update-db
     * Executa migrations e seeds do módulo
     */
    @Post(':slug/update-db')
    async updateDatabase(@Param('slug') slug: string) {
        return await this.installer.updateModuleDatabase(slug);
    }

    /**
     * GET /configuracoes/sistema/modulos/:slug/status
     * Verifica status detalhado de um módulo
     */
    @Get(':slug/status')
    async getModuleStatus(@Param('slug') slug: string) {
        return await this.installer.getModuleStatus(slug);
    }

    /**
     * DELETE /configuracoes/sistema/modulos/:slug/uninstall
     * Desinstala um módulo com opções de remoção de dados
     */
    @Delete(':slug/uninstall')
    async uninstallModule(
        @Param('slug') slug: string,
        @Body() body: {
            dataRemovalOption: 'keep' | 'core_only' | 'full';
            confirmationName: string;
        }
    ) {
        return await this.installer.uninstallModule(slug, body);
    }
}