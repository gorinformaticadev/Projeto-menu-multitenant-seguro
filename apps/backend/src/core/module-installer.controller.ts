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
    Request,
    ForbiddenException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ModuleInstallerService } from './module-installer.service';
import { memoryStorage } from 'multer';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Controller('configuracoes/sistema/modulos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class ModuleInstallerController {
    constructor(private readonly installer: ModuleInstallerService) { }

    private ensureMutableModuleOpsAllowed() {
        const isDev = process.env.NODE_ENV === 'development';
        const enabled = process.env.ENABLE_MODULE_UPLOAD === 'true';
        if (!isDev || !enabled) {
            throw new ForbiddenException(
                'Upload/uninstall/reload de modulos desabilitado. Em producao, use apenas ativacao/configuracao/migrations.'
            );
        }
    }

    @Get()
    async listModules(@Request() _req) {
        return await this.installer.listModules();
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file', {
        storage: memoryStorage(),
        limits: {
            fileSize: 50 * 1024 * 1024,
        }
    }))
    async uploadModule(@UploadedFile() file: Express.Multer.File, @Request() req) {
        this.ensureMutableModuleOpsAllowed();

        if (!file) {
            throw new BadRequestException('Arquivo nao fornecido');
        }

        if (!file.buffer) {
            throw new BadRequestException('Buffer do arquivo nao encontrado');
        }

        if (!Buffer.isBuffer(file.buffer)) {
            try {
                if (file.buffer && typeof file.buffer === 'object') {
                    const bufferArray = Object.values(file.buffer);
                    file.buffer = Buffer.from(bufferArray as number[]);
                } else {
                    file.buffer = Buffer.from(file.buffer as any);
                }
            } catch (conversionError) {
                throw new BadRequestException('Buffer invalido - nao foi possivel converter: ' + conversionError.message);
            }
        }

        return await this.installer.installModuleFromZip(
            file,
            req.user?.id || req.user?.sub,
            req.ip,
            req.headers?.['user-agent'] as string | undefined,
        );
    }

    @Post(':slug/activate')
    async activateModule(@Param('slug') slug: string) {
        return await this.installer.activateModule(slug);
    }

    @Post(':slug/deactivate')
    async deactivateModule(@Param('slug') slug: string) {
        return await this.installer.deactivateModule(slug);
    }

    @Post(':slug/update-db')
    async updateDatabase(@Param('slug') slug: string) {
        return await this.installer.updateModuleDatabase(slug);
    }

    @Post(':slug/run-migrations')
    async runMigrations(@Param('slug') slug: string) {
        return await this.installer.runModuleMigrations(slug);
    }

    @Post(':slug/run-seeds')
    async runSeeds(@Param('slug') slug: string) {
        return await this.installer.runModuleSeeds(slug);
    }

    @Get(':slug/status')
    async getModuleStatus(@Param('slug') slug: string) {
        return await this.installer.getModuleStatus(slug);
    }

    @Delete(':slug/uninstall')
    async uninstallModule(
        @Param('slug') slug: string,
        @Body() body: {
            dataRemovalOption: 'keep' | 'core_only' | 'full';
            confirmationName: string;
        }
    ) {
        this.ensureMutableModuleOpsAllowed();
        return await this.installer.uninstallModule(slug, body);
    }

    @Post(':slug/reload-config')
    async reloadConfig(@Param('slug') slug: string) {
        this.ensureMutableModuleOpsAllowed();
        return await this.installer.reloadModuleConfig(slug);
    }

    @Post(':slug/run-migrations-seeds')
    async runMigrationsAndSeeds(@Param('slug') slug: string) {
        try {
            return await this.installer.runMigrationsAndSeeds(slug);
        } catch (error) {
            throw error;
        }
    }
}
