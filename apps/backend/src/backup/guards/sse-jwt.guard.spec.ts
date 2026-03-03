import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SseJwtGuard } from './sse-jwt.guard';

describe('SseJwtGuard', () => {
  let guard: SseJwtGuard;
  let jwtService: jest.Mocked<JwtService>;

  const createContext = (request: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    guard = new SseJwtGuard(jwtService);
  });

  it('accepts bearer token from Authorization header', async () => {
    const request: any = {
      headers: { authorization: 'Bearer valid-token' },
      query: {},
      path: '/backup/download/123',
    };
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', role: 'SUPER_ADMIN' } as never);

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(request.user).toEqual({ sub: 'user-1', role: 'SUPER_ADMIN' });
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token', expect.any(Object));
  });

  it('accepts downloadToken from query string', async () => {
    const request: any = {
      headers: {},
      query: { downloadToken: 'download-token' },
      path: '/backup/download/abc',
    };
    const payload = { sub: 'user-1', role: 'SUPER_ADMIN', backupId: 'abc', type: 'backup-download' };
    jwtService.verifyAsync.mockResolvedValue(payload as never);

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(request.user).toEqual(payload);
    expect(request.downloadTokenPayload).toEqual(payload);
  });

  it('rejects request without token', async () => {
    const request: any = { headers: {}, query: {}, path: '/backup/download/abc' };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows expired token only for backup progress SSE endpoint', async () => {
    const request: any = {
      headers: {},
      query: { token: 'expired-token' },
      path: '/backup/progress/session-1',
    };
    jwtService.verifyAsync.mockRejectedValue({ name: 'TokenExpiredError' });
    jwtService.decode.mockReturnValue({ sub: 'user-1', role: 'SUPER_ADMIN' } as never);

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(request.user).toEqual({ sub: 'user-1', role: 'SUPER_ADMIN' });
  });

  it('rejects expired token for non-SSE endpoints', async () => {
    const request: any = {
      headers: {},
      query: { token: 'expired-token' },
      path: '/backup/download/abc',
    };
    jwtService.verifyAsync.mockRejectedValue({ name: 'TokenExpiredError' });
    jwtService.decode.mockReturnValue({ sub: 'user-1', role: 'SUPER_ADMIN' } as never);

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
