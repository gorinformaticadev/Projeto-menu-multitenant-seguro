import { Controller, Get, Post, Body, UseGuards, Param, Put, Patch, Delete, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
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
