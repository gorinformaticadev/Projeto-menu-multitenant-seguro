import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService security runtime enforcement', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  const jwtServiceMock = {
    sign: jest.fn(),
    decode: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  const auditServiceMock = {
    log: jest.fn(),
  };

  const twoFactorServiceMock = {
    verify: jest.fn(),
  };

  const tokenBlacklistServiceMock = {
    isTokenBlacklisted: jest.fn(),
    blacklistToken: jest.fn(),
  };

  const securityConfigServiceMock = {
    getLoginRateLimit: jest.fn(),
    getTwoFactorConfig: jest.fn(),
    getJwtConfig: jest.fn(),
  };

  const userSessionServiceMock = {
    createSession: jest.fn(),
    assertRefreshSessionActive: jest.fn(),
    revokeSession: jest.fn(),
  };

  const createService = () =>
    new AuthService(
      prismaMock as any,
      jwtServiceMock as any,
      configServiceMock as any,
      auditServiceMock as any,
      twoFactorServiceMock as any,
      tokenBlacklistServiceMock as any,
      securityConfigServiceMock as any,
      userSessionServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.get.mockImplementation((_key: string, fallback?: string) => fallback);
    securityConfigServiceMock.getLoginRateLimit.mockResolvedValue({
      maxAttempts: 5,
      lockDurationMinutes: 30,
      windowMinutes: 1,
    });
    securityConfigServiceMock.getTwoFactorConfig.mockResolvedValue({
      enabled: false,
      required: false,
      requiredForAdmins: false,
      suggested: true,
    });
    securityConfigServiceMock.getJwtConfig.mockResolvedValue({
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
      sessionTimeoutMinutes: 30,
    });
    auditServiceMock.log.mockResolvedValue(undefined);
    prismaMock.refreshToken.create.mockResolvedValue(undefined);
    jwtServiceMock.sign.mockReturnValue('jwt-token');
    jwtServiceMock.decode.mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 900,
      sid: 'session-1',
    });
    userSessionServiceMock.createSession.mockResolvedValue({
      id: 'session-1',
    });
    userSessionServiceMock.assertRefreshSessionActive.mockResolvedValue(undefined);
    userSessionServiceMock.revokeSession.mockResolvedValue(undefined);
  });

  it('blocks the normal login flow when the user already has 2FA enabled', async () => {
    const service = createService();
    const hashedPassword = await bcrypt.hash('SenhaValida!123', 4);

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin',
      role: 'ADMIN',
      tenantId: 'tenant-1',
      tenant: null,
      twoFactorEnabled: true,
      sessionVersion: 0,
      loginAttempts: 0,
      isLocked: false,
      lockedUntil: null,
      avatarUrl: null,
    });
    securityConfigServiceMock.getTwoFactorConfig.mockResolvedValue({
      enabled: true,
      required: false,
      requiredForAdmins: false,
      suggested: true,
    });

    await expect(
      service.login(
        {
          email: 'admin@example.com',
          password: 'SenhaValida!123',
        },
        '127.0.0.1',
        'jest',
      ),
    ).rejects.toThrow(
      new UnauthorizedException('2FA necessario para concluir o login. Informe o codigo de autenticacao.'),
    );

    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_2FA_CHALLENGE',
        userId: 'user-1',
      }),
    );
    expect(prismaMock.refreshToken.create).not.toHaveBeenCalled();
  });

  it('uses the persisted token policy and binds tokens to a backend session', async () => {
    const service = createService();
    securityConfigServiceMock.getJwtConfig.mockResolvedValue({
      accessTokenExpiresIn: '42m',
      refreshTokenExpiresIn: '9d',
      sessionTimeoutMinutes: 45,
    });
    jwtServiceMock.decode.mockReturnValue({
      exp: 1_900_000_000,
      sid: 'session-1',
    });

    const result = await service.generateTokens({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
      tenantId: 'tenant-1',
      sessionVersion: 3,
      ipAddress: '10.0.0.1',
      userAgent: 'jest',
    });

    expect(userSessionServiceMock.createSession).toHaveBeenCalledWith('user-1', 'tenant-1', {
      ipAddress: '10.0.0.1',
      userAgent: 'jest',
    });
    expect(jwtServiceMock.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-1',
        sessionVersion: 3,
        sid: 'session-1',
      }),
      expect.objectContaining({
        expiresIn: '42m',
      }),
    );

    const refreshTokenCreateArgs = prismaMock.refreshToken.create.mock.calls[0][0];
    const refreshTokenExpiresAt = refreshTokenCreateArgs.data.expiresAt as Date;
    const nineDaysInMs = 9 * 24 * 60 * 60 * 1000;

    expect(refreshTokenCreateArgs.data.sessionId).toBe('session-1');
    expect(refreshTokenExpiresAt.getTime() - Date.now()).toBeGreaterThan(nineDaysInMs - 5_000);
    expect(refreshTokenExpiresAt.getTime() - Date.now()).toBeLessThan(nineDaysInMs + 5_000);
    expect(result.accessTokenExpiresAt).toBe(new Date(1_900_000_000 * 1000).toISOString());
    expect(result.refreshTokenExpiresAt).toBe(refreshTokenExpiresAt.toISOString());
  });

  it('rejects refresh tokens that are not linked to a runtime session anymore', async () => {
    const service = createService();
    tokenBlacklistServiceMock.isTokenBlacklisted.mockResolvedValue(false);
    prismaMock.refreshToken.findUnique.mockResolvedValue({
      id: 'refresh-1',
      token: 'refresh-token',
      sessionId: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'ADMIN',
        tenantId: 'tenant-1',
        tenant: null,
        sessionVersion: 1,
      },
    });

    await expect(service.refreshTokens('refresh-token')).rejects.toThrow(
      new UnauthorizedException('Sessao legada expirada; faca login novamente'),
    );

    expect(prismaMock.refreshToken.delete).toHaveBeenCalledWith({
      where: { id: 'refresh-1' },
    });
    expect(userSessionServiceMock.assertRefreshSessionActive).not.toHaveBeenCalled();
  });
});
