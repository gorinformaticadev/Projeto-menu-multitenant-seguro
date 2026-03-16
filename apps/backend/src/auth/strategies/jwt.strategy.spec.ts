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

  const userSessionServiceMock = {
    assertAccessSessionActive: jest.fn(),
  };

  const createStrategy = () =>
    new JwtStrategy(
      configMock as any,
      prismaMock as any,
      tokenBlacklistServiceMock as any,
      userSessionServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    userSessionServiceMock.assertAccessSessionActive.mockResolvedValue(undefined);
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
          sid: 'session-1',
        },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects legacy access tokens without a backend session id', async () => {
    const strategy = createStrategy();
    tokenBlacklistServiceMock.isTokenBlacklisted.mockResolvedValue(false);

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
    ).rejects.toThrow(new UnauthorizedException('Sessao legada expirada; faca login novamente'));
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
          sid: 'session-1',
        },
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('updates session activity through the backend session ledger', async () => {
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
          ip: '10.0.0.9',
          headers: {
            authorization: 'Bearer valid-token',
            'user-agent': 'jest-agent',
          },
        } as any,
        {
          sub: 'user-1',
          email: 'user@example.com',
          role: 'ADMIN',
          tenantId: 'tenant-1',
          sessionVersion: 4,
          sid: 'session-9',
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
      sid: 'session-9',
    });

    expect(userSessionServiceMock.assertAccessSessionActive).toHaveBeenCalledWith(
      'session-9',
      'user-1',
      {
        ipAddress: '10.0.0.9',
        userAgent: 'jest-agent',
      },
    );
  });
});
