import { Controller, Get, Post, Body, UseGuards, Param, Put, Patch, Delete, UseInterceptors, UploadedFile, BadRequestException, Req } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { DuplicateRequestInterceptor } from '@core/common/interceptors/duplicate-request.interceptor';
import { TenantsService } from './tenants.service';
import { TenantModuleService } from '../modules/engine/backend/tenant-module.service';
import { CreateTenantDto } from '../../tenants/dto/create-tenant.dto';
import { UpdateTenantDto } from '../../tenants/dto/update-tenant.dto';
import { ChangeAdminPasswordDto } from '../../tenants/dto/change-admin-password.dto';
import {
  TenantResponseDto,
  TenantLogoResponseDto,
  TenantModulesResponseDto,
  SimpleMessageResponseDto,
} from './dto/tenant-response.dto';
import { ValidateResponse } from '@common/decorators/validate-response.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { SkipTenantIsolation } from '@core/common/decorators/skip-tenant-isolation.decorator';
import { Public } from '@core/common/decorators/public.decorator';
import { Role } from '@prisma/client';
import { multerConfig } from '@core/common/config/multer.config';
import { resolveLogosDirPath } from '@core/common/paths/paths.service';

type TenantRequest = ExpressRequest & {
  user: {
    id?: string;
    role: Role;
    tenantId?: string | null;
    [key: string]: unknown;
  };
};

@SkipThrottle()
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(
    private tenantsService: TenantsService,
    private tenantModuleService: TenantModuleService
  ) {
    // Empty implementation
  }

  // Assinaturas de arquivos válidas (magic numbers)
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
      const filePath = path.join(resolveLogosDirPath(), file.filename);
      const buffer = fs.readFileSync(filePath);

      const signature = this.FILE_SIGNATURES[file.mimetype];
      if (!signature) {
        // Remover arquivo inválido
        fs.unlinkSync(filePath);
        throw new BadRequestException('Tipo de arquivo não suportado');
      }

      // Verificar assinatura
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
          // Remover arquivo com assinatura inválida
          fs.unlinkSync(filePath);
          throw new BadRequestException('Arquivo corrompido ou tipo inválido');
        }
      }

      // Verificação adicional: tamanho mínimo para ser uma imagem válida
      if (buffer.length < 100) {
        fs.unlinkSync(filePath);
        throw new BadRequestException('Arquivo muito pequeno para ser uma imagem válida');
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
  @ValidateResponse(TenantResponseDto)
  async findAll(): Promise<TenantResponseDto[]> {
    return this.tenantsService.findAll() as any;
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(TenantResponseDto)
  async findOne(@Param('id') id: string): Promise<TenantResponseDto> {
    return this.tenantsService.findOne(id) as any;
  }

  @Get('my-tenant')
  @Roles(Role.ADMIN)
  @ValidateResponse(TenantResponseDto)
  async getMyTenant(@Req() req: TenantRequest): Promise<TenantResponseDto> {
    return this.tenantsService.findOne(req.user.tenantId) as any;
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(TenantResponseDto)
  async create(@Body() createTenantDto: CreateTenantDto): Promise<TenantResponseDto> {
    return this.tenantsService.create(createTenantDto) as any;
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(TenantResponseDto)
  async update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto): Promise<TenantResponseDto> {
    return this.tenantsService.update(id, updateTenantDto) as any;
  }

  @Put('my-tenant')
  @Roles(Role.ADMIN)
  @ValidateResponse(TenantResponseDto)
  async updateMyTenant(@Body() updateTenantDto: UpdateTenantDto, @Req() req: TenantRequest): Promise<TenantResponseDto> {
    return this.tenantsService.update(req.user.tenantId, updateTenantDto) as any;
  }

  @Post('my-tenant/upload-logo')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('logo', multerConfig))
  @ValidateResponse(TenantResponseDto)
  async uploadMyTenantLogo(@Req() req: TenantRequest, @UploadedFile() file: Express.Multer.File): Promise<TenantResponseDto> {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    // Validação adicional de segurança: verificar assinatura do arquivo
    await this.validateFileSignature(file);

    return this.tenantsService.updateLogo(req.user.tenantId, file.filename) as any;
  }

  @Patch('my-tenant/remove-logo')
  @Roles(Role.ADMIN)
  @ValidateResponse(TenantResponseDto)
  async removeMyTenantLogo(@Req() req: TenantRequest): Promise<TenantResponseDto> {
    return this.tenantsService.removeLogo(req.user.tenantId) as any;
  }

  @Patch(':id/toggle-status')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(TenantResponseDto)
  async toggleStatus(@Param('id') id: string): Promise<TenantResponseDto> {
    return this.tenantsService.toggleStatus(id) as any;
  }

  @Patch(':id/change-admin-password')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(TenantResponseDto)
  async changeAdminPassword(@Param('id') id: string, @Body() changePasswordDto: ChangeAdminPasswordDto): Promise<TenantResponseDto> {
    return this.tenantsService.changeAdminPassword(id, changePasswordDto) as any;
  }

  @Post(':id/upload-logo')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @UseInterceptors(FileInterceptor('logo', multerConfig))
  @ValidateResponse(TenantResponseDto)
  async uploadLogo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File): Promise<TenantResponseDto> {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    // Validação adicional de segurança: verificar assinatura do arquivo
    await this.validateFileSignature(file);

    return this.tenantsService.updateLogo(id, file.filename) as any;
  }

  @Patch(':id/remove-logo')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(TenantResponseDto)
  async removeLogo(@Param('id') id: string): Promise<TenantResponseDto> {
    return this.tenantsService.removeLogo(id) as any;
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(TenantResponseDto)
  async remove(@Param('id') id: string): Promise<TenantResponseDto> {
    return this.tenantsService.remove(id) as any;
  }

  @Public()
  @SkipThrottle()
  @Get('public/master-logo')
  @ValidateResponse(TenantLogoResponseDto)
  async getMasterLogo(): Promise<TenantLogoResponseDto> {
    return this.tenantsService.getMasterLogo() as any;
  }

  @Public()
  @SkipThrottle()
  @Get('public/:id/logo')
  @ValidateResponse(TenantLogoResponseDto)
  async getTenantLogo(@Param('id') id: string): Promise<TenantLogoResponseDto> {
    return this.tenantsService.getTenantLogo(id) as any;
  }

  @Get('my-tenant/modules/active')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @SkipThrottle()
  @ValidateResponse(TenantModulesResponseDto)
  async getMyTenantActiveModules(@Req() req: TenantRequest): Promise<TenantModulesResponseDto> {
    if (!req.user.tenantId) {
      if (req.user.role === Role.SUPER_ADMIN) {
        throw new BadRequestException('SUPER_ADMIN não possui contexto de tenant. Use um usuário ADMIN de tenant.');
      }
      throw new BadRequestException('Usuário sem vinculo com tenant.');
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
  @ValidateResponse(TenantModulesResponseDto)
  async getTenantActiveModules(@Param('id') id: string): Promise<TenantModulesResponseDto> {
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
  @ValidateResponse(SimpleMessageResponseDto)
  async activateModuleForTenant(@Param('id') id: string, @Param('moduleName') moduleName: string): Promise<SimpleMessageResponseDto> {
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
  async toggleMyTenantModule(@Param('moduleName') moduleName: string, @Req() req: TenantRequest) {
    if (!req.user.tenantId) {
      if (req.user.role === Role.SUPER_ADMIN) {
        throw new BadRequestException('SUPER_ADMIN não possui contexto de tenant. Use um usuário ADMIN de tenant.');
      }
      throw new BadRequestException('Usuário sem vinculo com tenant.');
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
    @Body() config: unknown) {
    return this.tenantsService.configureTenantModule(id, moduleName, config);
  }
}

