import * as speakeasy from 'speakeasy';
import { encryptSensitiveData } from '@core/common/utils/security.utils';
import { TwoFactorService } from './two-factor.service';

describe('TwoFactorService', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const securityConfigServiceMock = {
    getTwoFactorConfig: jest.fn(),
  };

  const trustedDeviceServiceMock = {
    revokeAllForUser: jest.fn(),
  };

  const auditServiceMock = {
    log: jest.fn(),
  };

  const authSchemaCompatibilityServiceMock = {
    getCapabilities: jest.fn(),
  };

  const createService = () =>
    new TwoFactorService(
      prismaMock as any,
      securityConfigServiceMock as any,
      trustedDeviceServiceMock as any,
      auditServiceMock as any,
      authSchemaCompatibilityServiceMock as any,
    );

  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    securityConfigServiceMock.getTwoFactorConfig.mockResolvedValue({
      enabled: true,
      required: false,
      requiredForAdmins: false,
      suggested: true,
    });
    trustedDeviceServiceMock.revokeAllForUser.mockResolvedValue(0);
    auditServiceMock.log.mockResolvedValue(undefined);
    prismaMock.user.update.mockResolvedValue(undefined);
    authSchemaCompatibilityServiceMock.getCapabilities.mockResolvedValue({
      hasTwoFactorPendingSecretColumn: true,
      hasSessionVersionColumn: true,
      hasTrustedDevicesTable: true,
      hasUserPreferencesTable: true,
      hasUserSessionsTable: true,
    });
  });

  it('stores a newly generated secret as pending without overwriting the active secret immediately', async () => {
    const service = createService();
    const activeSecret = encryptSensitiveData('ACTIVESECRET123456');

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      tenantId: 'tenant-1',
      twoFactorEnabled: true,
      twoFactorSecret: activeSecret,
      twoFactorPendingSecret: null,
    });

    const result = await service.generateSecret('user-1');

    expect(result.secret).toEqual(expect.any(String));
    expect(result.qrCode).toEqual(expect.stringContaining('data:image/png'));
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        twoFactorPendingSecret: expect.any(String),
      },
      select: { id: true },
    });
    expect(prismaMock.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          twoFactorSecret: expect.any(String),
        }),
      }),
    );
  });

  it('promotes the pending secret only after a valid token and revokes trusted devices on rotation', async () => {
    const service = createService();
    const pendingSecretPlain = speakeasy.generateSecret({ length: 20 }).base32;
    const activeSecret = encryptSensitiveData('ACTIVESECRET123456');
    const pendingSecret = encryptSensitiveData(pendingSecretPlain);
    const token = speakeasy.totp({
      secret: pendingSecretPlain,
      encoding: 'base32',
    });

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      tenantId: 'tenant-1',
      twoFactorEnabled: true,
      twoFactorSecret: activeSecret,
      twoFactorPendingSecret: pendingSecret,
    });

    await expect(service.enable('user-1', token)).resolves.toEqual({
      message: '2FA ativado com sucesso',
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: pendingSecret,
        twoFactorPendingSecret: null,
      },
      select: { id: true },
    });
    expect(trustedDeviceServiceMock.revokeAllForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        reason: '2fa_secret_rotated',
      }),
    );
  });

  it('falls back to the active secret column when pending-secret support is absent in a legacy database', async () => {
    authSchemaCompatibilityServiceMock.getCapabilities.mockResolvedValue({
      hasTwoFactorPendingSecretColumn: false,
      hasSessionVersionColumn: true,
      hasTrustedDevicesTable: false,
      hasUserPreferencesTable: true,
      hasUserSessionsTable: true,
    });
    const service = createService();

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      tenantId: 'tenant-1',
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });

    await service.generateSecret('user-1');

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        twoFactorSecret: expect.any(String),
      },
      select: { id: true },
    });
  });
});
