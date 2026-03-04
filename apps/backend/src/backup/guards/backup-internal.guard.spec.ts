import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BackupInternalGuard } from './backup-internal.guard';

describe('BackupInternalGuard', () => {
  const createContext = (request: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  const createGuard = (values: Record<string, string | undefined>): BackupInternalGuard => {
    const configService = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    return new BackupInternalGuard(configService);
  };

  it('permite localhost ipv4 127.0.0.1', () => {
    const guard = createGuard({
      BACKUP_INTERNAL_API_TOKEN: 'secret-token',
    });

    const request = {
      headers: {
        'x-backup-internal-token': 'secret-token',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      },
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
  });

  it('permite localhost ipv6 ::1 e ipv4-mapped ::ffff:127.0.0.1', () => {
    const guard = createGuard({
      BACKUP_INTERNAL_API_TOKEN: 'secret-token',
    });

    const ipv6Request = {
      headers: {
        'x-backup-internal-token': 'secret-token',
      },
      socket: {
        remoteAddress: '::1',
      },
    };

    const mappedRequest = {
      headers: {
        'x-backup-internal-token': 'secret-token',
      },
      socket: {
        remoteAddress: '::ffff:127.0.0.1',
      },
    };

    expect(guard.canActivate(createContext(ipv6Request))).toBe(true);
    expect(guard.canActivate(createContext(mappedRequest))).toBe(true);
  });

  it('nega IP publico', () => {
    const guard = createGuard({
      BACKUP_INTERNAL_API_TOKEN: 'secret-token',
    });

    const request = {
      headers: {
        'x-backup-internal-token': 'secret-token',
      },
      socket: {
        remoteAddress: '8.8.8.8',
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(ForbiddenException);
  });

  it('com trust proxy OFF ignora X-Forwarded-For', () => {
    const guard = createGuard({
      BACKUP_INTERNAL_API_TOKEN: 'secret-token',
      BACKUP_INTERNAL_TRUST_PROXY: 'false',
    });

    const request = {
      headers: {
        'x-backup-internal-token': 'secret-token',
        'x-forwarded-for': '127.0.0.1',
      },
      socket: {
        remoteAddress: '8.8.8.8',
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(ForbiddenException);
  });

  it('com trust proxy ON usa XFF apenas quando remoteAddress e proxy allowlisted', () => {
    const guard = createGuard({
      BACKUP_INTERNAL_API_TOKEN: 'secret-token',
      BACKUP_INTERNAL_TRUST_PROXY: 'true',
      BACKUP_INTERNAL_TRUSTED_PROXY_CIDRS: '10.0.0.0/8',
      BACKUP_INTERNAL_ALLOWED_CIDRS: '127.0.0.1/32,::1/128',
    });

    const deniedRequest = {
      headers: {
        'x-backup-internal-token': 'secret-token',
        'x-forwarded-for': '127.0.0.1',
      },
      socket: {
        remoteAddress: '8.8.8.8',
      },
    };

    const allowedRequest = {
      headers: {
        'x-backup-internal-token': 'secret-token',
        'x-forwarded-for': '203.0.113.10, 127.0.0.1',
      },
      socket: {
        remoteAddress: '10.10.1.5',
      },
    };

    expect(() => guard.canActivate(createContext(deniedRequest))).toThrow(ForbiddenException);
    expect(guard.canActivate(createContext(allowedRequest))).toBe(true);
  });

  it('falha fechado quando BACKUP_INTERNAL_ALLOWED_CIDRS esta vazio', () => {
    const guard = createGuard({
      BACKUP_INTERNAL_API_TOKEN: 'secret-token',
      BACKUP_INTERNAL_ALLOWED_CIDRS: '   ',
    });

    const request = {
      headers: {
        'x-backup-internal-token': 'secret-token',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(ForbiddenException);
  });
});
