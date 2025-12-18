import { Controller, Get, Post, Body, UseGuards, Param, Put, Patch, Delete, UseInterceptors, UploadedFile, BadRequestException, Req } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { DuplicateRequestInterceptor } from '@core/common/interceptors/duplicate-request.interceptor';
import { TenantsService } from './tenants.service';
import { TenantModuleService } from '../core/modules/engine/backend/tenant-module.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ChangeAdminPasswordDto } from './dto/change-admin-password.dto';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { SkipTenantIsolation } from '@core/common/decorators/skip-tenant-isolation.decorator';
import { Public } from '@core/common/decorators/public.decorator';
import { Role } from '@prisma/client';
import { multerConfig } from '@core/common/config/multer.config';

@SkipThrottle()
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(
    private tenantsService: TenantsService,
    private tenantModuleService: TenantModuleService
  ) { }

  // Assinaturas de arquivos vÃ¡lidas (magic numbers)
  private readonly FILE_SIGNATURES = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/webp': [0x52, 0x49, 0x46, 0x46],
    'image/gif': [0x47, 0x49, 0x46]
  };

  /**
   * Valida a assinatura real do arquivo para prevenir upload de arquivos maliciosos
   */
  private async validateFileSignature(file: Express.Multer.File): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    try {
      // Ler os primeiros bytes do arquivo
      const filePath = path.join(process.cwd(), 'uploads', 'logos', file.filename);
      const buffer = fs.readFileSync(filePath);

      const signature = this.FILE_SIGNATURES[file.mimetype];
      if (!signature) {
        // Remover arquivo invÃ¡lido
        fs.unlinkSync(filePath);
        throw new BadRequestException('Tipo de arquivo nÃ£o suportado');
      }

      // Verificar assinatura
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
          // Remover arquivo com assinatura invÃ¡lida
          fs.unlinkSync(filePath);
          throw new BadRequestException('Arquivo corrompido ou tipo invÃ¡lido');
        }
      }

      // VerificaÃ§Ã£o adicional: tamanho mÃ­nimo para ser uma imagem vÃ¡lida
      if (buffer.length < 100) {
        fs.unlinkSync(filePath);
        throw new BadRequestException('Arquivo muito pequeno para ser uma imagem vÃ¡lida');
      }

    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Erro ao validar arquivo');
    }
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  async findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  async findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Get('my-tenant')
  @Roles(Role.ADMIN)
  async getMyTenant(@Req() req: ExpressRequest & { user: any }) {
    return this.tenantsService.findOne(req.user.tenantId);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  async create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  async update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Put('my-tenant')
  @Roles(Role.ADMIN)
  async updateMyTenant(@Body() updateTenantDto: UpdateTenantDto, @Req() req: ExpressRequest & { user: any }) {
    return this.tenantsService.update(req.user.tenantId, updateTenantDto);
  }

  @Post('my-tenant/upload-logo')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('logo', multerConfig))
  async uploadMyTenantLogo(@Req() req: ExpressRequest & { user: any }, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    // ValidaÃ§Ã£o adicional de seguranÃ§a: verificar assinatura do arquivo
    await this.validateFileSignature(file);

    return this.tenantsService.updateLogo(req.user.tenantId, file.filename);
  }

  @Patch('my-tenant/remove-logo')
  @Roles(Role.ADMIN)
  async removeMyTenantLogo(@Req() req: ExpressRequest & { user: any }) {
    return this.tenantsService.removeLogo(req.user.tenantId);
  }

  @Patch(':id/toggle-status')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  async toggleStatus(@Param('id') id: string) {
    return this.tenantsService.toggleStatus(id);
  }

  @Patch(':id/change-admin-password')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  async changeAdminPassword(@Param('id') id: string, @Body() changePasswordDto: ChangeAdminPasswordDto) {
    return this.tenantsService.changeAdminPassword(id, changePasswordDto);
  }

  @Post(':id/upload-logo')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @UseInterceptors(FileInterceptor('logo', multerConfig))
  async uploadLogo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    // ValidaÃ§Ã£o adicional de seguranÃ§a: verificar assinatura do arquivo
    await this.validateFileSignature(file);

    return this.tenantsService.updateLogo(id, file.filename);
  }

  @Patch(':id/remove-logo')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  async removeLogo(@Param('id') id: string) {
    return this.tenantsService.removeLogo(id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  async remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }

  @Public()
  @SkipThrottle()
  @Get('public/master-logo')
  async getMasterLogo() {
    return this.tenantsService.getMasterLogo();
  }

  @Public()
  @SkipThrottle()
  @Get('public/:id/logo')
  async getTenantLogo(@Param('id') id: string) {
    return this.tenantsService.getTenantLogo(id);
  }

  // Endpoints para gerenciamento de mÃ³dulos dos tenants

  @Get('my-tenant/modules/active')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @SkipThrottle()
  async getMyTenantActiveModules(@Req() req: ExpressRequest & { user: any }) {
    if (!req.user.tenantId) {
      if (req.user.role === Role.SUPER_ADMIN) {
        // Se for SUPER_ADMIN sem tenant, retornamos uma lista vazia ou erro.
        // Para facilitar o desenvolvimento, vamos lanÃ§ar um aviso claro.
        throw new BadRequestException('SUPER_ADMIN nÃ£o possui contexto de tenant. Use um usuÃ¡rio ADMIN de tenant.');
      }
      throw new BadRequestException('UsuÃ¡rio sem vinculo com tenant.');
    }
    const modules = await this.tenantModuleService.getModulesForTenant(req.user.tenantId);
    return {
      modules: modules.filter(m => m.enabled).map(m => ({
        name: m.slug,
        isActive: m.enabled
      })),
      activeModules: modules.filter(m => m.enabled).map(m => m.slug)
    };
  }

  @Get(':id/modules/active')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @SkipThrottle()
  async getTenantActiveModules(@Param('id') id: string) {
    const modules = await this.tenantModuleService.getModulesForTenant(id);
    return {
      modules: modules.filter(m => m.enabled).map(m => ({
        name: m.slug,
        isActive: m.enabled
      })),
      activeModules: modules.filter(m => m.enabled).map(m => m.slug)
    };
  }

  @Post(':id/modules/:moduleName/activate')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @SkipThrottle()
  async activateModuleForTenant(@Param('id') id: string, @Param('moduleName') moduleName: string) {
    await this.tenantModuleService.activateModuleForTenant(moduleName, id);
    return { message: `Módulo ${moduleName} ativado para o tenant ${id}` };
  }

  @Post(':id/modules/:moduleName/deactivate')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @SkipThrottle()
  async deactivateModuleForTenant(@Param('id') id: string, @Param('moduleName') moduleName: string) {
    await this.tenantModuleService.deactivateModuleForTenant(moduleName, id);
    return { message: `Módulo ${moduleName} desativado para o tenant ${id}` };
  }

  @Post('my-tenant/modules/:moduleName/toggle')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @SkipThrottle()
  @UseInterceptors(DuplicateRequestInterceptor)
  async toggleMyTenantModule(@Param('moduleName') moduleName: string, @Req() req: ExpressRequest & { user: any }) {
    if (!req.user.tenantId) {
      if (req.user.role === Role.SUPER_ADMIN) {
        throw new BadRequestException('SUPER_ADMIN nÃ£o possui contexto de tenant. Use um usuÃ¡rio ADMIN de tenant.');
      }
      throw new BadRequestException('UsuÃ¡rio sem vinculo com tenant.');
    }
    return this.tenantsService.toggleModuleForTenant(req.user.tenantId, moduleName);
  }

  @Post(':id/modules/:moduleName/toggle')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @SkipThrottle()
  @UseInterceptors(DuplicateRequestInterceptor)
  async toggleModuleForTenant(@Param('id') id: string, @Param('moduleName') moduleName: string) {
    return this.tenantsService.toggleModuleForTenant(id, moduleName);
  }

  @Put(':id/modules/:moduleName/config')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @SkipThrottle()
  async configureTenantModule(
    @Param('id') id: string,
    @Param('moduleName') moduleName: string,
    @Body() config: any
  ) {
    return this.tenantsService.configureTenantModule(id, moduleName, config);
  }
}

