import { UnauthorizedException } from '@nestjs/common';
import { AuthValidationService } from '../auth-validation.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy session validation', () => {
  const configMock = {
    get: jest.fn().mockReturnValue('jwt-secret'),
  };

  const authValidationServiceMock = {
    validatePayload: jest.fn(),
  };

  const createStrategy = () =>
    new JwtStrategy(
      configMock as any,
      authValidationServiceMock as unknown as AuthValidationService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a revoked bearer token', async () => {
    const strategy = createStrategy();
    authValidationServiceMock.validatePayload.mockRejectedValue(new UnauthorizedException());

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

    expect(authValidationServiceMock.validatePayload).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-1',
        sid: 'session-1',
      }),
      {
        rawToken: 'revoked-token',
        ipAddress: undefined,
        userAgent: undefined,
        source: 'http',
      },
    );
  });

  it('rejects legacy access tokens without a backend session id', async () => {
    const strategy = createStrategy();
    authValidationServiceMock.validatePayload.mockRejectedValue(
      new UnauthorizedException('Sessao legada expirada; faca login novamente'),
    );

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
    authValidationServiceMock.validatePayload.mockRejectedValue(new UnauthorizedException());

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
    authValidationServiceMock.validatePayload.mockResolvedValue({
      id: 'user-1',
      sub: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
      tenantId: 'tenant-1',
      name: 'Admin User',
      sessionVersion: 4,
      sid: 'session-9',
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

    expect(authValidationServiceMock.validatePayload).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-1',
        sid: 'session-9',
      }),
      {
        rawToken: 'valid-token',
        ipAddress: '10.0.0.9',
        userAgent: 'jest-agent',
        source: 'http',
      },
    );
  });
});
