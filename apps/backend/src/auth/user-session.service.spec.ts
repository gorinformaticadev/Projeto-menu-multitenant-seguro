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
    },
    refreshToken: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const securityRuntimeConfigServiceMock = {
    getSessionPolicy: jest.fn(),
  };

  const createService = () =>
    new UserSessionService(prismaMock as any, securityRuntimeConfigServiceMock as any);

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
    prismaMock.userSession.update.mockResolvedValue(undefined);
  });

  it('updates last activity on authenticated requests', async () => {
    const service = createService();
    prismaMock.userSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      lastActivityAt: new Date(Date.now() - 5 * 60_000),
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
      revokedAt: null,
    });

    await expect(service.assertRefreshSessionActive('session-3', 'user-1')).rejects.toThrow(
      new UnauthorizedException('Sessao expirada por inatividade'),
    );

    expect(prismaMock.userSession.update).not.toHaveBeenCalled();
  });
});
