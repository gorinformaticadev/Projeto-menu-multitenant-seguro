import { Controller, Get, Post, Body, UseGuards, Param, Put, Patch, Delete, UseInterceptors, UploadedFile, BadRequestException, Req } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ChangeAdminPasswordDto } from './dto/change-admin-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTenantIsolation } from '../common/decorators/skip-tenant-isolation.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Role } from '@prisma/client';
import { multerConfig } from '../common/config/multer.config';

@SkipThrottle()
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

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
      const filePath = path.join(process.cwd(), 'uploads', 'logos', file.filename);
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
    
    // Validação adicional de segurança: verificar assinatura do arquivo
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
    
    // Validação adicional de segurança: verificar assinatura do arquivo
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
}
