import { BadRequestException } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService runtime password policy enforcement', () => {
  const prismaMock = {
    passwordResetToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const emailServiceMock = {
    sendPasswordResetEmail: jest.fn(),
  };

  const jwtServiceMock = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn(),
  };

  const securityConfigServiceMock = {
    getPasswordPolicy: jest.fn(),
  };

  const createService = () =>
    new PasswordResetService(
      prismaMock as any,
      emailServiceMock as any,
      jwtServiceMock as any,
      configServiceMock as any,
      securityConfigServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    configServiceMock.get.mockImplementation((key: string) =>
      key === 'JWT_SECRET' ? 'test-secret' : undefined,
    );
    securityConfigServiceMock.getPasswordPolicy.mockResolvedValue({
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecial: true,
    });
  });

  it('rejects reset passwords that violate the persisted policy', async () => {
    const service = createService();

    jwtServiceMock.verify.mockReturnValue({
      userId: 'user-1',
      email: 'user@example.com',
      type: 'password-reset',
    });
    prismaMock.passwordResetToken.findFirst.mockResolvedValue({
      id: 'reset-1',
      userId: 'user-1',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        isLocked: false,
      },
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    await expect(service.resetPassword('valid-token', 'fraca')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
