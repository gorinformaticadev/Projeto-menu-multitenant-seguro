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

    private buildActorContext(req: Record<string, any> | undefined) {
        return {
            userId: req?.user?.id || req?.user?.sub,
            ipAddress: req?.ip,
            userAgent: req?.headers?.['user-agent'] as string | undefined,
        };
    }

    private getMutableModuleOpsStatus() {
        const environment = (process.env.NODE_ENV || 'development').trim().toLowerCase();
        const overrideEnabled = process.env.ENABLE_MODULE_UPLOAD === 'true';
        const isDevelopment = environment === 'development';
        const mutableModuleOpsAllowed = isDevelopment || overrideEnabled;

        return {
            environment,
            overrideEnabled,
            mutableModuleOpsAllowed,
            reason: isDevelopment
                ? 'development'
                : overrideEnabled
                    ? 'explicit_override'
                    : 'blocked',
            message: isDevelopment
                ? 'Operacoes mutaveis de modulos liberadas automaticamente em development.'
                : overrideEnabled
                    ? 'Operacoes mutaveis de modulos liberadas por ENABLE_MODULE_UPLOAD=true.'
                    : 'Upload/uninstall/reload de modulos desabilitado fora de development. Defina ENABLE_MODULE_UPLOAD=true para liberar explicitamente.'
        };
    }

    private ensureMutableModuleOpsAllowed() {
        const status = this.getMutableModuleOpsStatus();
        if (!status.mutableModuleOpsAllowed) {
            throw new ForbiddenException(status.message);
        }
    }

    @Get()
    async listModules(@Request() _req): Promise<unknown> {
        return await this.installer.listModules();
    }

    @Get('capabilities')
    getCapabilities() {
        return this.getMutableModuleOpsStatus();
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file', {
        storage: memoryStorage(),
        limits: {
            fileSize: 50 * 1024 * 1024,
        }
    }))
    async uploadModule(@UploadedFile() file: Express.Multer.File, @Request() req): Promise<unknown> {
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
    async updateDatabase(@Param('slug') slug: string, @Request() req) {
        return await this.installer.updateModuleDatabase(slug, this.buildActorContext(req));
    }

    @Post(':slug/prepare-database')
    async prepareDatabase(@Param('slug') slug: string, @Request() req) {
        return await this.installer.prepareModuleDatabase(slug, {
            invokedBy: 'prepare-database',
            actor: this.buildActorContext(req),
        });
    }

    @Post(':slug/run-migrations')
    async runMigrations(@Param('slug') slug: string, @Request() req) {
        return await this.installer.runModuleMigrations(slug, this.buildActorContext(req));
    }

    @Post(':slug/run-seeds')
    async runSeeds(@Param('slug') slug: string, @Request() req) {
        return await this.installer.runModuleSeeds(slug, this.buildActorContext(req));
    }

    @Get(':slug/status')
    async getModuleStatus(@Param('slug') slug: string): Promise<unknown> {
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
    async runMigrationsAndSeeds(@Param('slug') slug: string, @Request() req) {
        try {
            return await this.installer.runMigrationsAndSeeds(slug, this.buildActorContext(req));
        } catch (error) {
            throw error;
        }
    }
}
