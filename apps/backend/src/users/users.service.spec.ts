import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

describe('UsersService security boundaries', () => {
  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
    },
  };

  const createService = () => new UsersService(prismaMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
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
});
