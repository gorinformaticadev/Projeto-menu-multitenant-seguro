import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto, UserListResponseDto } from './dto/user-response.dto';
import { ValidateResponse } from '@common/decorators/validate-response.decorator';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { SkipTenantIsolation } from '@core/common/decorators/skip-tenant-isolation.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '@core/common/decorators/current-user.decorator';

type AuthenticatedUser = {
  id: string;
  role: Role;
  tenantId?: string | null;
};

@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(UserResponseDto)
  async create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    // Se for ADMIN, força o tenantId do usuário logado
    if (user.role === Role.ADMIN) {
      createUserDto.tenantId = user.tenantId;
      // ADMIN só pode criar USER ou CLIENT
      if (createUserDto.role === Role.SUPER_ADMIN || createUserDto.role === Role.ADMIN) {
        throw new Error('ADMIN não pode criar SUPER_ADMIN ou ADMIN');
      }
    }
    return this.usersService.create(createUserDto) as any;
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(UserListResponseDto)
  async findAll(@Query('tenantId') tenantId?: string, @CurrentUser() user?: AuthenticatedUser): Promise<UserListResponseDto> {
    // Se for ADMIN, força buscar apenas do seu tenant
    let users;
    if (user?.role === Role.ADMIN) {
      users = await this.usersService.findAll(user.tenantId);
    } else {
      users = await this.usersService.findAll(tenantId);
    }
    return {
      users: users as any,
      total: users.length,
    };
  }

  @Get('tenant/:tenantId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(UserListResponseDto)
  async findByTenant(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthenticatedUser): Promise<UserListResponseDto> {
    // ADMIN só pode acessar o próprio tenant
    if (user.role === Role.ADMIN && user.tenantId !== tenantId) {
      throw new Error('ADMIN não pode acessar usuários de outros tenants');
    }
    const users = await this.usersService.findByTenant(tenantId);
    return {
      users: users as any,
      total: users.length,
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(UserResponseDto)
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id) as any;
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(UserResponseDto)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto) as any;
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(UserResponseDto)
  async remove(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.remove(id) as any;
  }

  /**
   * PUT /users/profile
   * Atualizar perfil do usuário logado
   */
  @Put('profile')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.CLIENT)
  @ValidateResponse(UserResponseDto)
  async updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(user.id, updateProfileDto) as any;
  }

  /**
   * PUT /users/change-password
   * Alterar senha do usuário logado
   */
  @Put('change-password')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.CLIENT)
  @ValidateResponse(UserResponseDto)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.changePassword(user.id, changePasswordDto) as any;
  }

  /**
   * POST /users/:id/unlock
   * Desbloquear usuário
   * Apenas SUPER_ADMIN e ADMIN
   */
  @Post(':id/unlock')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @SkipTenantIsolation()
  @ValidateResponse(UserResponseDto)
  async unlockUser(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.unlockUser(id) as any;
  }

}
