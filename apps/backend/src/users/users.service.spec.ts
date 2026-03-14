import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveTenantUserAvatarFilePath } from '@core/common/paths/paths.service';
import { UsersService } from './users.service';

describe('UsersService security boundaries', () => {
  const prismaMock = {
    user: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
    },
  };

  const securityConfigServiceMock = {
    getPasswordPolicy: jest.fn(),
  };

  const createService = () =>
    new UsersService(prismaMock as any, securityConfigServiceMock as any);
  let tempUploadsDir: string;
  let previousUploadsDir: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    securityConfigServiceMock.getPasswordPolicy.mockResolvedValue({
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecial: true,
    });
    tempUploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'users-avatar-'));
    previousUploadsDir = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = tempUploadsDir;
  });

  afterEach(() => {
    fs.rmSync(tempUploadsDir, { recursive: true, force: true });
    if (previousUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = previousUploadsDir;
    }
  });

  it('blocks tenant ADMIN from reading a user outside the tenant scope', async () => {
    const service = createService();
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('user-2', {
        id: 'admin-1',
        role: Role.ADMIN,
        tenantId: 'tenant-1',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'user-2',
          tenantId: 'tenant-1',
        },
      }),
    );
  });

  it('blocks tenant ADMIN from managing administrative users in the same tenant', async () => {
    const service = createService();
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'admin-2',
      email: 'admin2@example.com',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
    });

    await expect(
      service.update(
        'admin-2',
        { name: 'Updated name' },
        {
          id: 'admin-1',
          role: Role.ADMIN,
          tenantId: 'tenant-1',
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('increments session version and clears refresh tokens when changing password', async () => {
    const service = createService();
    const currentPasswordHash = await bcrypt.hash('SenhaAtual!123', 4);

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      password: currentPasswordHash,
    });
    prismaMock.user.update.mockResolvedValue({ id: 'user-1' });
    prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'SenhaAtual!123',
        newPassword: 'NovaSenha!123',
      }),
    ).resolves.toEqual({ message: 'Senha alterada com sucesso' });

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          lastPasswordChange: expect.any(Date),
          sessionVersion: {
            increment: 1,
          },
        }),
      }),
    );
    expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('rejects user creation when the password violates the runtime policy', async () => {
    const service = createService();
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        email: 'user@example.com',
        password: 'fraca',
        name: 'User One',
        role: Role.USER,
        tenantId: 'tenant-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('stores user avatar in a tenant-scoped directory and exposes a public avatar URL', async () => {
    const service = createService();
    const jpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      tenantId: 'tenant-1',
      avatarUrl: null,
    });
    prismaMock.user.update.mockImplementation(async (args: any) => ({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User One',
      role: Role.USER,
      tenantId: 'tenant-1',
      avatarUrl: args.data.avatarUrl,
      tenant: null,
    }));

    const updated = await service.updateProfileAvatar('user-1', {
      buffer: jpegBuffer,
      extension: '.jpg',
    });

    const avatarDir = path.join(
      tempUploadsDir,
      'tenants',
      'tenant-1',
      'users',
      'user-1',
      'avatar',
    );

    expect(fs.existsSync(avatarDir)).toBe(true);
    expect(fs.readdirSync(avatarDir).length).toBe(1);
    expect(updated.avatarUrl).toBe('/api/users/public/user-1/avatar-file');
  });

  it('removes avatar file and clears avatarUrl from profile', async () => {
    const service = createService();
    const avatarFilePath = resolveTenantUserAvatarFilePath('tenant-1', 'user-1', 'avatar-test.jpg');
    fs.writeFileSync(avatarFilePath, Buffer.from([0xff, 0xd8, 0xff]), { mode: 0o600 });

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      tenantId: 'tenant-1',
      avatarUrl: 'avatar-test.jpg',
    });
    prismaMock.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User One',
      role: Role.USER,
      tenantId: 'tenant-1',
      avatarUrl: null,
      tenant: null,
    });

    const updated = await service.removeProfileAvatar('user-1');

    expect(fs.existsSync(avatarFilePath)).toBe(false);
    expect(updated.avatarUrl).toBeNull();
  });
});
