import {
    Controller,
    Post,
    Get,
    Delete,
    Param,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    Request,
    HttpStatus,
    HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ModuleUploadService } from './module-upload.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('api/modules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class ModuleManagementController {
    constructor(
        private readonly uploadService: ModuleUploadService,
        private readonly prisma: PrismaService
    ) { }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    @HttpCode(HttpStatus.CREATED)
    async uploadModule(
        @UploadedFile() file: Express.Multer.File,
        @Request() req
    ) {
        const result = await this.uploadService.uploadModule({
            file,
            uploadedBy: req.user.userId
        });

        return {
            success: result.success,
            message: result.message,
            data: {
                moduleId: result.moduleId,
                slug: result.slug,
                validation: {
                    valid: result.validation.valid,
                    score: result.validation.score,
                    errors: result.validation.errors,
                    warnings: result.validation.warnings
                }
            }
        };
    }

    @Get()
    async listModules() {
        const modules = await this.prisma.moduleUpload.findMany({
            include: {
                pages: true,
                permissions: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return {
            success: true,
            data: modules.map(module => ({
                id: module.id,
                slug: module.slug,
                name: module.name,
                version: module.version,
                description: module.description,
                author: module.author,
                category: module.category,
                enabled: module.enabled,
                validated: module.validated,
                sandboxed: module.sandboxed,
                uploadedAt: module.uploadedAt,
                pagesCount: module.pages.length,
                permissionsCount: module.permissions.length
            }))
        };
    }

    @Get(':id')
    async getModule(@Param('id') id: string) {
        const module = await this.prisma.moduleUpload.findUnique({
            where: { id },
            include: {
                pages: true,
                permissions: true
            }
        });

        if (!module) {
            return {
                success: false,
                message: 'Módulo não encontrado'
            };
        }

        return {
            success: true,
            data: module
        };
    }

    @Post(':id/validate')
    async validateModule(@Param('id') id: string) {
        await this.prisma.moduleUpload.update({
            where: { id },
            data: { validated: true }
        });

        return {
            success: true,
            message: 'Módulo validado com sucesso'
        };
    }

    @Post(':id/enable')
    async enableModule(@Param('id') id: string) {
        await this.prisma.moduleUpload.update({
            where: { id },
            data: { enabled: true }
        });

        return {
            success: true,
            message: 'Módulo ativado com sucesso'
        };
    }

    @Post(':id/disable')
    async disableModule(@Param('id') id: string) {
        await this.prisma.moduleUpload.update({
            where: { id },
            data: { enabled: false }
        });

        return {
            success: true,
            message: 'Módulo desativado com sucesso'
        };
    }

    @Delete(':id')
    async deleteModule(@Param('id') id: string) {
        await this.prisma.moduleUpload.delete({
            where: { id }
        });

        return {
            success: true,
            message: 'Módulo removido com sucesso'
        };
    }
} 