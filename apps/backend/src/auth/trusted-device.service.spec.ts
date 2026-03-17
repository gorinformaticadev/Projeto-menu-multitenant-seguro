import { TrustedDeviceService } from './trusted-device.service';

describe('TrustedDeviceService', () => {
  const prismaMock = {
    trustedDevice: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  const auditServiceMock = {
    log: jest.fn(),
  };

  const createService = () =>
    new TrustedDeviceService(
      prismaMock as any,
      configServiceMock as any,
      auditServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'TRUSTED_DEVICE_TOKEN_SECRET') {
        return 'trusted-secret';
      }

      if (key === 'JWT_SECRET') {
        return 'jwt-secret';
      }

      return undefined;
    });
    auditServiceMock.log.mockResolvedValue(undefined);
    prismaMock.trustedDevice.create.mockResolvedValue({
      id: 'trusted-1',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    prismaMock.trustedDevice.update.mockResolvedValue(undefined);
    prismaMock.trustedDevice.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.trustedDevice.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('issues a random token and stores only the token hash', async () => {
    const service = createService();

    const result = await service.issueTrustedDevice({
      userId: 'user-1',
      tenantId: 'tenant-1',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(result.token).toEqual(expect.any(String));
    expect(result.token.length).toBeGreaterThan(40);
    expect(prismaMock.trustedDevice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          tokenHash: expect.any(String),
          createdIp: '127.0.0.1',
        }),
      }),
    );

    const storedHash = prismaMock.trustedDevice.create.mock.calls[0][0].data.tokenHash;
    expect(storedHash).not.toBe(result.token);
  });

  it('returns not_found and clear-cookie=true when trusted token does not exist', async () => {
    const service = createService();
    prismaMock.trustedDevice.findUnique.mockResolvedValue(null);

    await expect(
      service.validateTrustedDevice({
        userId: 'user-1',
        token: 'unknown-token',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'not_found',
        shouldBypass2FA: false,
        shouldClearCookie: true,
      }),
    );
  });

  it('returns valid and updates last usage metadata when trusted token is active', async () => {
    const service = createService();
    prismaMock.trustedDevice.findUnique.mockResolvedValue({
      id: 'trusted-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      lastUsedIp: null,
    });

    await expect(
      service.validateTrustedDevice({
        userId: 'user-1',
        token: 'valid-token',
        ipAddress: '10.0.0.10',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: 'valid',
        shouldBypass2FA: true,
        shouldClearCookie: false,
        trustedDeviceId: 'trusted-1',
      }),
    );

    expect(prismaMock.trustedDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'trusted-1' },
        data: expect.objectContaining({
          lastUsedAt: expect.any(Date),
          lastUsedIp: '10.0.0.10',
        }),
      }),
    );
  });

  it('revokes all active trusted devices for a user and returns the revoked count', async () => {
    const service = createService();
    prismaMock.trustedDevice.updateMany.mockResolvedValue({ count: 3 });

    await expect(
      service.revokeAllForUser({
        userId: 'user-1',
        revokedByUserId: 'admin-1',
        reason: 'admin_forced_revocation',
      }),
    ).resolves.toBe(3);

    expect(prismaMock.trustedDevice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          revokedAt: null,
        },
      }),
    );
    expect(auditServiceMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TRUSTED_DEVICE_REVOKED',
        userId: 'user-1',
      }),
    );
  });
});
