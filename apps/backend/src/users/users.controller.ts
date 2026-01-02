import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { SkipTenantIsolation } from '@core/common/decorators/skip-tenant-isolation.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '@core/common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: any) {
    // Se for ADMIN, forÃ§a o tenantId do usuÃ¡rio logado
    if (user.role === Role.ADMIN) {
      createUserDto.tenantId = user.tenantId;
      // ADMIN sÃ³ pode criar USER ou CLIENT
      if (createUserDto.role === Role.SUPER_ADMIN || createUserDto.role === Role.ADMIN) {
        throw new Error('ADMIN nÃ£o pode criar SUPER_ADMIN ou ADMIN');
      }
    }
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  findAll(@Query('tenantId') tenantId?: string, @CurrentUser() user?: any) {
    // Se for ADMIN, forÃ§a buscar apenas do seu tenant
    if (user?.role === Role.ADMIN) {
      return this.usersService.findAll(user.tenantId);
    }
    return this.usersService.findAll(tenantId);
  }

  @Get('tenant/:tenantId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  findByTenant(@Param('tenantId') tenantId: string, @CurrentUser() user: any) {
    // ADMIN sÃ³ pode acessar o prÃ³prio tenant
    if (user.role === Role.ADMIN && user.tenantId !== tenantId) {
      throw new Error('ADMIN nÃ£o pode acessar usuÃ¡rios de outros tenants');
    }
    return this.usersService.findByTenant(tenantId);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  /**
   * PUT /users/profile
   * Atualizar perfil do usuÃ¡rio logado
   */
  @Put('profile')
  updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  /**
   * PUT /users/change-password
   * Alterar senha do usuÃ¡rio logado
   */
  @Put('change-password')
  changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.changePassword(user.id, changePasswordDto);
  }

  /**
   * PATCH /users/preferences
   * Atualizar preferências do usuário (Tema)
   */
  @Patch('preferences')
  updatePreferences(
    @Body('theme') theme: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.updatePreferences(user.id, theme);
  }

  /**
   * POST /users/:id/unlock
   * Desbloquear usuÃ¡rio
   * Apenas SUPER_ADMIN e ADMIN
   */
  @Post(':id/unlock')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  unlockUser(@Param('id') id: string) {
    return this.usersService.unlockUser(id);
  }

}

