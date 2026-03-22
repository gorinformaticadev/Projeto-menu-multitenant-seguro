import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { access, unlink, writeFile } from 'fs/promises';
import { basename } from 'path';
import { PrismaService } from '@core/prisma/prisma.service';
import { SecurityConfigService } from '@core/security-config/security-config.service';
import { TrustedDeviceService } from '../auth/trusted-device.service';
import {
  resolveTenantUserAvatarDirPath,
  resolveTenantUserAvatarFilePath,
} from '@core/common/paths/paths.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ThemeEnum } from './dto/update-preferences.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { validatePasswordAgainstPolicy } from '../common/utils/password-policy.util';

type UserScopeActor = {
  id: string;
  role: Role;
  email?: string;
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

  constructor(
    private prisma: PrismaService,
    private securityConfigService: SecurityConfigService,
    private trustedDeviceService: TrustedDeviceService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { email, password, name, role, tenantId } = createUserDto;

    await this.assertPasswordMatchesPolicy(password);

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
    let passwordUpdated = false;
    if (updateUserDto.password && updateUserDto.password.trim() !== '') {
      await this.assertPasswordMatchesPolicy(updateUserDto.password);
      data.password = await bcrypt.hash(updateUserDto.password, 10);
      data.lastPasswordChange = new Date();
      data.sessionVersion = {
        increment: 1,
      };
      passwordUpdated = true;
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

    if (passwordUpdated) {
      await this.prisma.refreshToken.deleteMany({
        where: { userId: id },
      });

      await this.trustedDeviceService.revokeAllForUser({
        userId: id,
        tenantId: (user as { tenantId?: string | null }).tenantId || null,
        revokedByUserId: actor.id,
        reason: 'admin_password_changed',
        actor: {
          userId: actor.id,
          role: actor.role,
        },
      });
    }

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

  async revokeTrustedDevices(
    userId: string,
    actor: UserScopeActor,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Apenas SUPER_ADMIN pode revogar dispositivos confiaveis');
    }

    const user = (await this.findOne(userId, actor)) as unknown as ScopedUser;

    const revokedCount = await this.trustedDeviceService.revokeAllForUser({
      userId: user.id,
      tenantId: user.tenantId || null,
      revokedByUserId: actor.id,
      reason: 'admin_forced_revocation',
      actor: {
        userId: actor.id,
        role: actor.role,
        email: actor.email,
      },
      ipAddress,
      userAgent,
    });

    return {
      message: 'Dispositivos confiaveis revogados com sucesso',
      revokedCount,
    };
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

    await this.assertPasswordMatchesPolicy(newPassword);

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

    await this.trustedDeviceService.revokeAllForUser({
      userId,
      tenantId: user.tenantId,
      revokedByUserId: userId,
      reason: 'user_password_changed',
      actor: {
        userId,
        role: user.role,
        email: user.email,
      },
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

  async lockUser(userId: string, actor: UserScopeActor) {
    const user = (await this.findOne(userId, actor)) as unknown as ScopedUser;
    this.assertActorCanManageTarget(actor, user);
    this.auditCrossTenantAction('lock_user', actor, user.id, user.tenantId);

    if (user.isLocked) {
      throw new BadRequestException('Usuario ja esta bloqueado');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isLocked: true,
        lockedAt: new Date(),
      },
    });

    return { message: 'Usuario bloqueado com sucesso' };
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

  async updateProfileAvatar(userId: string, upload: { buffer: Buffer; extension: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    const storageTenantId = this.resolveStorageTenantId(user.tenantId);
    resolveTenantUserAvatarDirPath(storageTenantId, user.id);

    const fileName = `${Date.now()}-${randomUUID()}${upload.extension}`;
    const avatarPath = resolveTenantUserAvatarFilePath(storageTenantId, user.id, fileName);
    await writeFile(avatarPath, upload.buffer, { mode: 0o600 });

    const previousAvatarPath = await this.resolveExistingAvatarFilePath(
      storageTenantId,
      user.id,
      user.avatarUrl,
    );

    if (previousAvatarPath) {
      try {
        await unlink(previousAvatarPath);
      } catch {
        // noop
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: fileName },
      include: {
        tenant: {
          select: {
            id: true,
            nomeFantasia: true,
          },
        },
      },
    });

    return this.sanitizeUser(updatedUser);
  }

  async removeProfileAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    if (!user.avatarUrl) {
      throw new BadRequestException('Usuario nao possui avatar');
    }

    const storageTenantId = this.resolveStorageTenantId(user.tenantId);
    const avatarPath = await this.resolveExistingAvatarFilePath(storageTenantId, user.id, user.avatarUrl);

    if (avatarPath) {
      try {
        await unlink(avatarPath);
      } catch {
        // noop
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: null },
      include: {
        tenant: {
          select: {
            id: true,
            nomeFantasia: true,
          },
        },
      },
    });

    return this.sanitizeUser(updatedUser);
  }

  async getProfileAvatarFilePath(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        avatarUrl: true,
      },
    });

    if (!user || !user.avatarUrl) {
      throw new NotFoundException('Avatar do usuario nao encontrado');
    }

    const storageTenantId = this.resolveStorageTenantId(user.tenantId);
    const avatarPath = await this.resolveExistingAvatarFilePath(storageTenantId, user.id, user.avatarUrl);
    if (!avatarPath) {
      throw new NotFoundException('Arquivo de avatar nao encontrado');
    }

    return avatarPath;
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

  private resolveStorageTenantId(tenantId?: string | null) {
    const normalized = String(tenantId || '').trim();
    return normalized || 'platform';
  }

  private getSafeAssetFilename(value?: string | null): string | null {
    if (!value || typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const safeName = basename(normalized);
    if (safeName !== normalized) {
      return null;
    }

    return safeName;
  }

  private async resolveExistingAvatarFilePath(
    storageTenantId: string,
    userId: string,
    avatarUrl?: string | null,
  ): Promise<string | null> {
    const safeName = this.getSafeAssetFilename(avatarUrl);
    if (!safeName) {
      return null;
    }

    try {
      const avatarPath = resolveTenantUserAvatarFilePath(storageTenantId, userId, safeName);
      await access(avatarPath);
      return avatarPath;
    } catch {
      return null;
    }
  }

  private buildUserAvatarPublicUrl(userId: string) {
    return `/api/users/public/${encodeURIComponent(userId)}/avatar-file`;
  }

  private sanitizeUser(user: any): any {
    const safeUser = { ...user };
    delete safeUser.password;
    if (safeUser?.id) {
      safeUser.avatarUrl = safeUser.avatarUrl
        ? this.buildUserAvatarPublicUrl(String(safeUser.id))
        : null;
    }
    return safeUser;
  }

  private async assertPasswordMatchesPolicy(password: string): Promise<void> {
    const policy = await this.securityConfigService.getPasswordPolicy();
    const errors = validatePasswordAgainstPolicy(password, policy);
    if (errors.length > 0) {
      throw new BadRequestException(errors.join(' '));
    }
  }
}
