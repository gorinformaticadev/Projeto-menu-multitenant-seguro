import { SecurityRuntimeConfigService } from './security-runtime-config.service';

describe('SecurityRuntimeConfigService regression guards', () => {
  const prismaMock = {
    securityConfig: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const createService = () => new SecurityRuntimeConfigService(prismaMock as any);
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.securityConfig.findFirst.mockReset();
    prismaMock.securityConfig.create.mockReset();
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('keeps security_config as runtime source of truth for global rate limiting', async () => {
    prismaMock.securityConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      globalMaxRequests: 4321,
      globalWindowMinutes: 3,
      rateLimitDevEnabled: true,
      rateLimitProdEnabled: false,
    });

    const service = createService();
    const policy = await service.getGlobalRateLimitPolicy();

    expect(policy).toEqual(
      expect.objectContaining({
        source: 'security_config',
        requests: 4321,
        windowMinutes: 3,
        enabled: true,
      }),
    );
    expect(prismaMock.securityConfig.findFirst).toHaveBeenCalledTimes(1);
  });

  it('creates a safe security_config row when none exists', async () => {
    prismaMock.securityConfig.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'cfg-2',
      loginMaxAttempts: 5,
      loginLockDurationMinutes: 30,
      loginWindowMinutes: 1,
      globalMaxRequests: 10000,
      globalWindowMinutes: 1,
      rateLimitDevEnabled: false,
      rateLimitProdEnabled: false,
      backupRateLimitPerHour: 5,
      restoreRateLimitPerHour: 3,
      updateRateLimitPerHour: 5,
      passwordMinLength: 8,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecial: true,
      accessTokenExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
      twoFactorEnabled: false,
      twoFactorRequired: false,
      twoFactorRequiredForAdmins: false,
      twoFactorSuggested: true,
      sessionTimeoutMinutes: 30,
      maxActiveSessionsPerUser: 5,
      refreshTokenRotation: true,
    });
    prismaMock.securityConfig.create.mockResolvedValue({
      id: 'cfg-2',
    });

    const service = createService();
    await service.getSecurityConfig();

    expect(prismaMock.securityConfig.create).toHaveBeenCalledWith({
      data: {},
    });
  });

  it('reads critical quotas from security_config without falling back to decorators', async () => {
    prismaMock.securityConfig.findFirst.mockResolvedValue({
      id: 'cfg-3',
      backupRateLimitPerHour: 9,
      restoreRateLimitPerHour: 7,
      updateRateLimitPerHour: 4,
    });

    const service = createService();
    const policy = await service.getCriticalRateLimitPolicy();

    expect(policy).toEqual(
      expect.objectContaining({
        source: 'security_config',
        backupPerHour: 9,
        restorePerHour: 7,
        updatePerHour: 4,
      }),
    );
  });
});
