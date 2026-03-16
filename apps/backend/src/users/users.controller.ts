import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { CurrentUser } from '@core/common/decorators/current-user.decorator';
import { Public } from '@core/common/decorators/public.decorator';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import {
  createImageMulterOptions,
  validateUploadedImageBuffer,
} from '@core/common/utils/image-upload.util';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserPreferencesDto } from './dto/update-preferences.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type AuthenticatedUser = {
  id: string;
  role: Role;
  tenantId?: string | null;
};

const USER_AVATAR_UPLOAD_OPTIONS = createImageMulterOptions();

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    if (user.role === Role.ADMIN) {
      createUserDto.tenantId = user.tenantId;

      if (createUserDto.role === Role.SUPER_ADMIN || createUserDto.role === Role.ADMIN) {
        throw new ForbiddenException('ADMIN nao pode criar SUPER_ADMIN ou ADMIN');
      }
    }

    if (user.role !== Role.SUPER_ADMIN && !user.tenantId) {
      throw new BadRequestException('Usuario autenticado nao possui tenant valido');
    }

    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findAll(@Query('tenantId') tenantId?: string, @CurrentUser() user?: AuthenticatedUser) {
    if (user?.role === Role.ADMIN) {
      return this.usersService.findAll(user.tenantId);
    }

    return this.usersService.findAll(tenantId);
  }

  @Get('tenant/:tenantId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findByTenant(@Param('tenantId') tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    if (user.role === Role.ADMIN && user.tenantId !== tenantId) {
      throw new ForbiddenException('ADMIN nao pode acessar usuarios de outros tenants');
    }

    return this.usersService.findByTenant(tenantId);
  }

  @Patch('preferences')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.CLIENT)
  updatePreferences(
    @Body() updateUserPreferencesDto: UpdateUserPreferencesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (updateUserPreferencesDto.theme) {
      return this.usersService.updatePreferences(user.id, updateUserPreferencesDto.theme);
    }

    return { message: 'No preferences to update' };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const targetUser = (await this.usersService.findOne(id, currentUser)) as { role?: Role };
    const adminAssignableRoles: Role[] = [Role.USER, Role.CLIENT];

    if (targetUser.role === Role.SUPER_ADMIN) {
      if (updateUserDto.role && updateUserDto.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('Nao e possivel alterar a funcao de um SUPER_ADMIN');
      }

      if (currentUser.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('Apenas SUPER_ADMIN pode editar outro SUPER_ADMIN');
      }
    }

    if (
      currentUser.role === Role.ADMIN &&
      updateUserDto.role &&
      !adminAssignableRoles.includes(updateUserDto.role as Role)
    ) {
      throw new ForbiddenException('ADMIN nao pode atribuir papeis administrativos');
    }

    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async remove(@Param('id') id: string, @CurrentUser() currentUser: AuthenticatedUser) {
    const targetUser = (await this.usersService.findOne(id, currentUser)) as { role?: Role };

    if (targetUser.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Nao e possivel excluir um usuario SUPER_ADMIN');
    }

    return this.usersService.remove(id, currentUser);
  }

  @Put('profile')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.CLIENT)
  updateProfile(
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Post('profile/avatar')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.CLIENT)
  @UseInterceptors(FileInterceptor('avatar', USER_AVATAR_UPLOAD_OPTIONS))
  updateProfileAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    const validatedUpload = validateUploadedImageBuffer(file);
    return this.usersService.updateProfileAvatar(user.id, validatedUpload);
  }

  @Patch('profile/avatar/remove')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.CLIENT)
  removeProfileAvatar(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.removeProfileAvatar(user.id);
  }

  @Put('change-password')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.CLIENT)
  changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.changePassword(user.id, changePasswordDto);
  }

  @Post(':id/unlock')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  unlockUser(@Param('id') id: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.unlockUser(id, currentUser);
  }

  @Post(':id/lock')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  lockUser(@Param('id') id: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.lockUser(id, currentUser);
  }

  @Public()
  @Get('public/:id/avatar-file')
  async getPublicAvatarFile(@Param('id') id: string, @Res() res: Response) {
    const avatarFilePath = await this.usersService.getProfileAvatarFilePath(id);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.sendFile(avatarFilePath);
  }
}
