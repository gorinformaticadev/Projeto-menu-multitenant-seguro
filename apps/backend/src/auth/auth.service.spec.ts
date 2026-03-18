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
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
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

  const trustedDeviceServiceMock = {
    validateTrustedDevice: jest.fn(),
    issueTrustedDevice: jest.fn(),
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
      trustedDeviceServiceMock as any,
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
    prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        refreshToken: prismaMock.refreshToken,
      }),
    );
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
    trustedDeviceServiceMock.validateTrustedDevice.mockResolvedValue({
      status: 'missing',
      shouldBypass2FA: false,
      shouldClearCookie: false,
    });
    trustedDeviceServiceMock.issueTrustedDevice.mockResolvedValue({
      token: 'trusted-token',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  it('returns a formal REQUIRES_TWO_FACTOR contract when the user already has 2FA enabled', async () => {
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
    ).resolves.toMatchObject({
      status: 'REQUIRES_TWO_FACTOR',
      authenticated: false,
      requiresTwoFactor: true,
      mustEnrollTwoFactor: false,
      clearTrustedDeviceCookie: false,
    });

    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_2FA_CHALLENGE',
        userId: 'user-1',
      }),
    );
    expect(prismaMock.refreshToken.create).not.toHaveBeenCalled();
  });

  it('returns MUST_ENROLL_TWO_FACTOR when the policy requires 2FA and the user has not enrolled yet', async () => {
    const service = createService();
    const hashedPassword = await bcrypt.hash('SenhaValida!123', 4);

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin',
      role: 'ADMIN',
      tenantId: 'tenant-1',
      tenant: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      sessionVersion: 0,
      loginAttempts: 0,
      isLocked: false,
      lockedUntil: null,
      avatarUrl: null,
    });
    securityConfigServiceMock.getTwoFactorConfig.mockResolvedValue({
      enabled: true,
      required: true,
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
    ).resolves.toMatchObject({
      status: 'MUST_ENROLL_TWO_FACTOR',
      authenticated: false,
      requiresTwoFactor: false,
      mustEnrollTwoFactor: true,
      enrollmentToken: expect.any(String),
      enrollmentExpiresAt: expect.any(String),
    });

    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'LOGIN_2FA_ENROLLMENT_REQUIRED',
        userId: 'user-2',
      }),
    );
    expect(prismaMock.refreshToken.create).not.toHaveBeenCalled();
  });

  it('bypasses 2FA when the trusted device token is valid after password validation', async () => {
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
    trustedDeviceServiceMock.validateTrustedDevice.mockResolvedValue({
      status: 'valid',
      shouldBypass2FA: true,
      shouldClearCookie: false,
      trustedDeviceId: 'trusted-1',
    });

    await expect(
      service.login(
        {
          email: 'admin@example.com',
          password: 'SenhaValida!123',
        },
        '127.0.0.1',
        'jest',
        'trusted-token',
      ),
    ).resolves.toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });

    expect(trustedDeviceServiceMock.validateTrustedDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        token: 'trusted-token',
      }),
    );
    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TRUSTED_DEVICE_USED',
        userId: 'user-1',
      }),
    );
  });

  it('falls back to the same formal REQUIRES_TWO_FACTOR contract when trusted device token is invalid', async () => {
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
    trustedDeviceServiceMock.validateTrustedDevice.mockResolvedValue({
      status: 'expired',
      shouldBypass2FA: false,
      shouldClearCookie: true,
      trustedDeviceId: 'trusted-1',
    });

    await expect(
      service.login(
        {
          email: 'admin@example.com',
          password: 'SenhaValida!123',
        },
        '127.0.0.1',
        'jest',
        'stale-token',
      ),
    ).resolves.toMatchObject({
      status: 'REQUIRES_TWO_FACTOR',
      authenticated: false,
      requiresTwoFactor: true,
      mustEnrollTwoFactor: false,
      clearTrustedDeviceCookie: true,
    });

    expect(trustedDeviceServiceMock.validateTrustedDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        token: 'stale-token',
      }),
    );
    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TRUSTED_DEVICE_INVALID',
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

    expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { id: 'refresh-1' },
    });
    expect(userSessionServiceMock.assertRefreshSessionActive).not.toHaveBeenCalled();
  });

  it('consumes the refresh token atomically and blocks concurrent refresh reuse', async () => {
    const service = createService();
    tokenBlacklistServiceMock.isTokenBlacklisted.mockResolvedValue(false);

    const storedToken = {
      id: 'refresh-atomic',
      token: 'refresh-atomic-token',
      sessionId: 'session-1',
      expiresAt: new Date(Date.now() + 120_000),
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'ADMIN',
        tenantId: 'tenant-1',
        tenant: null,
        sessionVersion: 3,
      },
      session: {
        id: 'session-1',
      },
    };

    prismaMock.refreshToken.findUnique.mockResolvedValue(storedToken);
    prismaMock.refreshToken.deleteMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prismaMock.refreshToken.create.mockResolvedValue(undefined);

    const results = await Promise.allSettled([
      service.refreshTokens('refresh-atomic-token'),
      service.refreshTokens('refresh-atomic-token'),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(userSessionServiceMock.assertRefreshSessionActive).toHaveBeenCalledWith(
      'session-1',
      'user-1',
    );
  });
});
