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
        console.log('\n========== CONTROLLER - uploadModule ==========');
        console.log('1. Arquivo recebido:', {
            exists: !!file,
            originalname: file?.originalname,
            mimetype: file?.mimetype,
            size: file?.size,
            fieldname: file?.fieldname,
            encoding: file?.encoding
        });
        
        if (!file) {
            console.log('❌ ERRO: Arquivo não fornecido');
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
            console.log('❌ ERRO: Buffer do arquivo não encontrado');
            throw new BadRequestException('Buffer do arquivo não encontrado');
        }

        if (!Buffer.isBuffer(file.buffer)) {
            console.log('❌ ERRO CRÍTICO: file.buffer NÃO é um Buffer!');
            console.log('Tipo recebido:', (file.buffer as any)?.constructor?.name);
            console.log('Tentando converter para Buffer...');
            
            try {
                // Se buffer é um Object com chaves numéricas (serializado)
                if (file.buffer && typeof file.buffer === 'object') {
                    console.log('Detectado Object com chaves:', Object.keys(file.buffer).slice(0, 10));
                    
                    // Converter Object numérico para Array e depois para Buffer
                    const bufferArray = Object.values(file.buffer);
                    console.log('Array extraído - length:', bufferArray.length);
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
                    console.log('✅ Conversão direta bem-sucedida');
                    file.buffer = bufferData;
                }
            } catch (conversionError) {
                console.log('❌ Falha na conversão:', conversionError.message);
                console.log('Detalhes do buffer:', {
                    type: typeof file.buffer,
                    constructor: (file.buffer as any)?.constructor?.name,
                    keys: Object.keys(file.buffer || {}).slice(0, 20),
                    values: Object.values(file.buffer || {}).slice(0, 10)
                });
                throw new BadRequestException('Buffer inválido - não foi possível converter: ' + conversionError.message);
            }
        }

        console.log('3. Buffer válido confirmado - Chamando installModuleFromZip');
        console.log('===============================================\n');
        
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