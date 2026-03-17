import { UnauthorizedException } from '@nestjs/common';
import { UserSessionService } from './user-session.service';

describe('UserSessionService inactivity enforcement', () => {
  const prismaMock = {
    userSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const securityRuntimeConfigServiceMock = {
    getSessionPolicy: jest.fn(),
  };

  const trustedDeviceServiceMock = {
    revokeAllForUser: jest.fn(),
  };

  const createService = () =>
    new UserSessionService(
      prismaMock as any,
      securityRuntimeConfigServiceMock as any,
      trustedDeviceServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    securityRuntimeConfigServiceMock.getSessionPolicy.mockResolvedValue({
      timeoutMinutes: 30,
      maxActiveSessionsPerUser: 5,
      refreshTokenRotation: true,
    });
    prismaMock.$transaction.mockImplementation(async (operations: unknown[]) => operations);
    prismaMock.userSession.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.userSession.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.userSession.update.mockResolvedValue(undefined);
    trustedDeviceServiceMock.revokeAllForUser.mockResolvedValue(1);
  });

  it('updates last activity on authenticated requests', async () => {
    const service = createService();
    prismaMock.userSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      lastActivityAt: new Date(Date.now() - 5 * 60_000),
      expiresAt: new Date(Date.now() + 25 * 60_000),
      revokedAt: null,
      lastIpAddress: null,
      lastUserAgent: null,
    });

    await expect(
      service.assertAccessSessionActive('session-1', 'user-1', {
        ipAddress: '10.0.0.10',
        userAgent: 'jest',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'session-1',
      }),
    );

    expect(prismaMock.userSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          lastIpAddress: '10.0.0.10',
          lastUserAgent: 'jest',
          expiresAt: expect.any(Date),
        }),
      }),
    );
  });

  it('revokes the session when inactivity timeout is exceeded', async () => {
    const service = createService();
    prismaMock.userSession.findUnique.mockResolvedValue({
      id: 'session-2',
      userId: 'user-1',
      lastActivityAt: new Date(Date.now() - 31 * 60_000),
      expiresAt: new Date(Date.now() - 1_000),
      revokedAt: null,
    });

    await expect(service.assertAccessSessionActive('session-2', 'user-1')).rejects.toThrow(
      new UnauthorizedException('Sessao expirada por inatividade'),
    );

    expect(prismaMock.userSession.updateMany).toHaveBeenCalled();
    expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        sessionId: 'session-2',
      },
    });
  });

  it('applies the same inactivity rule during refresh without relying on the frontend timer', async () => {
    const service = createService();
    prismaMock.userSession.findUnique.mockResolvedValue({
      id: 'session-3',
      userId: 'user-1',
      lastActivityAt: new Date(Date.now() - 31 * 60_000),
      expiresAt: new Date(Date.now() - 1_000),
      revokedAt: null,
    });

    await expect(service.assertRefreshSessionActive('session-3', 'user-1')).rejects.toThrow(
      new UnauthorizedException('Sessao expirada por inatividade'),
    );

    expect(prismaMock.userSession.update).not.toHaveBeenCalled();
  });

  it('rejects revoked sessions from the ledger immediately', async () => {
    const service = createService();
    prismaMock.userSession.findUnique.mockResolvedValue({
      id: 'session-4',
      userId: 'user-1',
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    });

    await expect(service.assertAccessSessionActive('session-4', 'user-1')).rejects.toThrow(
      new UnauthorizedException('Sessao expirada ou revogada'),
    );
    expect(prismaMock.userSession.update).not.toHaveBeenCalled();
  });

  it('purges expired session rows through cleanup', async () => {
    const service = createService();
    prismaMock.userSession.deleteMany.mockResolvedValue({ count: 3 });

    await expect(service.cleanupExpiredSessions()).resolves.toBe(3);
    expect(prismaMock.userSession.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: {
          lt: expect.any(Date),
        },
      },
    });
  });
});
