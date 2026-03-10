import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ThemeEnum } from './dto/update-preferences.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type UserScopeActor = {
  id: string;
  role: Role;
  tenantId?: string | null;
};

type ScopedUser = {
  id: string;
  email: string;
  role: Role;
  tenantId?: string | null;
  isLocked?: boolean;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { email, password, name, role, tenantId } = createUserDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Ja existe um usuario com este email');
    }

    if (role !== Role.SUPER_ADMIN && !tenantId) {
      throw new BadRequestException('TenantId e obrigatorio para usuarios que nao sao SUPER_ADMIN');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        tenantId: role === Role.SUPER_ADMIN ? null : tenantId,
      },
      include: {
        tenant: true,
      },
    });

    return this.sanitizeUser(user);
  }

  async findAll(tenantId?: string): Promise<any[]> {
    const users = await this.prisma.user.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            nomeFantasia: true,
          },
        },
      },
    });

    return users.map((item) => this.sanitizeUser(item));
  }

  async findOne(id: string, actor?: UserScopeActor): Promise<any> {
    const user = await this.prisma.user.findFirst({
      where: this.buildUserScopeWhere(id, actor),
      include: {
        tenant: {
          select: {
            id: true,
            nomeFantasia: true,
          },
        },
        preferences: true,
      } as any,
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    return this.sanitizeUser(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto, actor: UserScopeActor) {
    const existingUser = (await this.findOne(id, actor)) as unknown as ScopedUser;
    this.assertActorCanManageTarget(actor, existingUser);
    this.auditCrossTenantAction('update_user', actor, existingUser.id, existingUser.tenantId);

    if (updateUserDto.email) {
      const duplicatedUser = await this.prisma.user.findFirst({
        where: {
          AND: [{ id: { not: id } }, { email: updateUserDto.email }],
        },
      });

      if (duplicatedUser) {
        throw new ConflictException('Ja existe um usuario com este email');
      }
    }

    const data: Record<string, any> = { ...updateUserDto };
    if (updateUserDto.password && updateUserDto.password.trim() !== '') {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
      data.lastPasswordChange = new Date();
    } else {
      delete data.password;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        tenant: {
          select: {
            id: true,
            nomeFantasia: true,
          },
        },
      },
    });

    return this.sanitizeUser(user);
  }

  async remove(id: string, actor: UserScopeActor) {
    const user = (await this.findOne(id, actor)) as unknown as ScopedUser;
    this.assertActorCanManageTarget(actor, user);
    this.auditCrossTenantAction('delete_user', actor, user.id, user.tenantId);

    if (user.email === 'admin@system.com') {
      throw new BadRequestException('O SUPER_ADMIN padrao nao pode ser deletado');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'Usuario deletado com sucesso' };
  }

  async findByTenant(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((item) => this.sanitizeUser(item));
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException('A nova senha deve ser diferente da senha atual');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        lastPasswordChange: new Date(),
        sessionVersion: {
          increment: 1,
        },
      } as any,
    });

    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return { message: 'Senha alterada com sucesso' };
  }

  async unlockUser(userId: string, actor: UserScopeActor) {
    const user = (await this.findOne(userId, actor)) as unknown as ScopedUser;
    this.assertActorCanManageTarget(actor, user);
    this.auditCrossTenantAction('unlock_user', actor, user.id, user.tenantId);

    if (!user.isLocked) {
      throw new BadRequestException('Usuario nao esta bloqueado');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: false,
        loginAttempts: 0,
        lockedAt: null,
        lockedUntil: null,
        lastFailedLoginAt: null,
      },
    });

    return { message: 'Usuario desbloqueado com sucesso' };
  }

  async updateProfile(userId: string, updateProfileDto: { name: string; email: string }) {
    const { name, email } = updateProfileDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Este email ja esta em uso');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name, email },
      include: {
        tenant: true,
      },
    });

    return this.sanitizeUser(user);
  }

  async updatePreferences(userId: string, theme: ThemeEnum) {
    return this.prisma.userPreferences.upsert({
      where: { userId },
      update: { theme },
      create: { userId, theme },
    });
  }

  private buildUserScopeWhere(id: string, actor?: UserScopeActor) {
    if (!actor || actor.role === Role.SUPER_ADMIN) {
      return { id };
    }

    return {
      id,
      tenantId: actor.tenantId || '__missing_tenant__',
    };
  }

  private assertActorCanManageTarget(actor: UserScopeActor, targetUser: ScopedUser) {
    if (actor.role === Role.SUPER_ADMIN) {
      return;
    }

    if (!actor.tenantId || targetUser.tenantId !== actor.tenantId) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    if (targetUser.role === Role.SUPER_ADMIN || targetUser.role === Role.ADMIN) {
      throw new ForbiddenException('ADMIN nao pode gerenciar usuarios administrativos');
    }
  }

  private auditCrossTenantAction(
    action: string,
    actor: UserScopeActor,
    targetUserId: string,
    targetTenantId?: string | null,
  ) {
    if (actor.role !== Role.SUPER_ADMIN) {
      return;
    }

    if (actor.tenantId === targetTenantId) {
      return;
    }

    this.logger.warn(
      JSON.stringify({
        event: action,
        actorId: actor.id,
        actorTenantId: actor.tenantId ?? null,
        targetUserId,
        targetTenantId: targetTenantId ?? null,
      }),
    );
  }

  private sanitizeUser(user: any): any {
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }
}
