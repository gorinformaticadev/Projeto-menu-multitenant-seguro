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
    BadRequestException,
    Request
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ModuleInstallerService } from './module-installer.service';
import { memoryStorage } from 'multer';

import { SkipThrottle } from '@nestjs/throttler';

/**
 * Controller para instalação e gerenciamento de módulos
 * Interface: /configuracoes/sistema/modulos
 */
@SkipThrottle()
@Controller('configuracoes/sistema/modulos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class ModuleInstallerController {
    // Controller refreshed
    constructor(private readonly installer: ModuleInstallerService) { }

    /**
     * GET /configuracoes/sistema/modulos
     * Lista módulos instalados e disponíveis
     */
    @Get()
    async listModules(@Request() req) {
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

        console.log('2. Verificando buffer:', {
            bufferExists: !!file.buffer,
            bufferType: typeof file.buffer,
            bufferConstructor: file.buffer?.constructor?.name,
            isBuffer: Buffer.isBuffer(file.buffer),
            bufferLength: file.buffer?.length,
            bufferKeys: file.buffer ? Object.keys(file.buffer).slice(0, 10) : []
        });

        if (!file.buffer) {
            throw new BadRequestException('Buffer do arquivo não encontrado');
        }

        if (!Buffer.isBuffer(file.buffer)) {
            console.log('Tipo recebido:', (file.buffer as any)?.constructor?.name);
            try {
                // Se buffer é um Object com chaves numéricas (serializado)
                if (file.buffer && typeof file.buffer === 'object') {
                    console.log('Detectado Object com chaves:', Object.keys(file.buffer).slice(0, 10));

                    // Converter Object numérico para Array e depois para Buffer
                    const bufferArray = Object.values(file.buffer);
                    console.log('Primeiros valores:', bufferArray.slice(0, 10));

                    const bufferData = Buffer.from(bufferArray as number[]);
                    console.log('✅ Conversão bem-sucedida:', {
                        isBuffer: Buffer.isBuffer(bufferData),
                        length: bufferData.length,
                        first4Bytes: Array.from(bufferData.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0'))
                    });
                    file.buffer = bufferData;
                } else {
                    // Tentar conversão direta
                    const bufferData = Buffer.from(file.buffer as any);
                    file.buffer = bufferData;
                }
            } catch (conversionError) {
                console.log('Detalhes do buffer:', {
                    type: typeof file.buffer,
                    constructor: (file.buffer as any)?.constructor?.name,
                    keys: Object.keys(file.buffer || {}).slice(0, 20),
                    values: Object.values(file.buffer || {}).slice(0, 10)
                });
                throw new BadRequestException('Buffer inválido - não foi possível converter: ' + conversionError.message);
            }
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
     * POST /configuracoes/sistema/modulos/:slug/run-migrations
     * Executa apenas migrations
     */
    @Post(':slug/run-migrations')
    async runMigrations(@Param('slug') slug: string) {
        return await this.installer.runModuleMigrations(slug);
    }

    /**
     * POST /configuracoes/sistema/modulos/:slug/run-seeds
     * Executa apenas seeds e finaliza preparação
     */
    @Post(':slug/run-seeds')
    async runSeeds(@Param('slug') slug: string) {
        return await this.installer.runModuleSeeds(slug);
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
    /**
     * POST /configuracoes/sistema/modulos/:slug/reload-config
     * Recarrega configurações e menus do módulo a partir do disco
     * (Adicionado para permitir atualização sem reinstalação)
     */
    @Post(':slug/reload-config')
    async reloadConfig(@Param('slug') slug: string) {
        return await this.installer.reloadModuleConfig(slug);
    }

    /**
     * POST /configuracoes/sistema/modulos/:slug/run-migrations-seeds
     * Executa novamente as migrations e seeds do módulo
     */
    @Post(':slug/run-migrations-seeds')
    async runMigrationsAndSeeds(@Param('slug') slug: string) {
        try {
            const result = await this.installer.runMigrationsAndSeeds(slug);
            return result;
        } catch (error) {
            console.error(`❌ Controller: Erro ao executar migrations/seeds para ${slug}:`, error);
            throw error;
        }
    }
}