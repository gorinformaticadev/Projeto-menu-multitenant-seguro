import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy session validation', () => {
  const configMock = {
    get: jest.fn().mockReturnValue('jwt-secret'),
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const tokenBlacklistServiceMock = {
    isTokenBlacklisted: jest.fn(),
  };

  const createStrategy = () =>
    new JwtStrategy(
      configMock as any,
      prismaMock as any,
      tokenBlacklistServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a revoked bearer token', async () => {
    const strategy = createStrategy();
    tokenBlacklistServiceMock.isTokenBlacklisted.mockResolvedValue(true);

    await expect(
      strategy.validate(
        {
          headers: {
            authorization: 'Bearer revoked-token',
          },
        } as any,
        {
          sub: 'user-1',
          email: 'user@example.com',
          role: 'USER',
          tenantId: 'tenant-1',
          sessionVersion: 2,
        },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects stale tokens after session version changes', async () => {
    const strategy = createStrategy();
    tokenBlacklistServiceMock.isTokenBlacklisted.mockResolvedValue(false);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      tenantId: 'tenant-1',
      name: 'User One',
      sessionVersion: 3,
    });

    await expect(
      strategy.validate(
        {
          headers: {
            authorization: 'Bearer valid-token',
          },
        } as any,
        {
          sub: 'user-1',
          email: 'user@example.com',
          role: 'USER',
          tenantId: 'tenant-1',
          sessionVersion: 2,
        },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns a fresh normalized user when the token still matches the current session', async () => {
    const strategy = createStrategy();
    tokenBlacklistServiceMock.isTokenBlacklisted.mockResolvedValue(false);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
      tenantId: 'tenant-1',
      name: 'Admin User',
      sessionVersion: 4,
    });

    await expect(
      strategy.validate(
        {
          headers: {
            authorization: 'Bearer valid-token',
          },
        } as any,
        {
          sub: 'user-1',
          email: 'user@example.com',
          role: 'ADMIN',
          tenantId: 'tenant-1',
          sessionVersion: 4,
        },
      ),
    ).resolves.toEqual({
      id: 'user-1',
      sub: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
      tenantId: 'tenant-1',
      name: 'Admin User',
      sessionVersion: 4,
    });
  });
});
