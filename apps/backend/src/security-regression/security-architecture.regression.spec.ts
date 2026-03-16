import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');

function readSource(relativePathFromSrc: string): string {
  return fs.readFileSync(path.resolve(PROJECT_ROOT, relativePathFromSrc), 'utf8');
}

describe('Security architecture regression guards', () => {
  it('keeps security_config as the runtime source of truth for security policy', () => {
    const source = readSource('core/security-config/security-runtime-config.service.ts');

    expect(source).toContain('this.prisma.securityConfig.findFirst');
    expect(source).toContain("source: 'security_config'");
    expect(source).not.toContain('this.prisma.systemSetting');
  });

  it('keeps refresh token rotation transactional and bound to active session validation', () => {
    const source = readSource('auth/auth.service.ts');

    expect(source).toContain('this.prisma.$transaction(async (tx)');
    expect(source).toContain('assertRefreshSessionActive');
    expect(source).toContain('consumed.count !== 1');
    expect(source).toContain("throw new UnauthorizedException('Refresh token invalido ou ja utilizado')");
  });

  it('keeps throttler principal extraction dependent on JWT signature verification', () => {
    const source = readSource('common/guards/security-throttler.guard.ts');

    expect(source).toContain('const payload = this.verifyJwtPayload(token);');
    expect(source).not.toContain('const payload = this.decodeJwtPayload(token);');
    expect(source).toContain('verifyJwtPayload(token)');
    expect(source).toContain('this.jwtVerifier.verify');
  });

  it('keeps backend inactivity enforcement stateful in UserSessionService', () => {
    const source = readSource('auth/user-session.service.ts');

    expect(source).toContain('assertAccessSessionActive');
    expect(source).toContain('assertRefreshSessionActive');
    expect(source).toContain('isSessionExpired');
    expect(source).toContain("revokeSession(session.id, 'inactive_timeout')");
  });

  it('keeps strict redis mode fail-closed (no silent memory fallback)', () => {
    const source = readSource('common/services/redis-throttler.storage.ts');

    expect(source).toContain("if (this.failureMode === 'strict')");
    expect(source).toContain('throw new SharedThrottlerStorageUnavailableError');
    expect(source).toContain('return this.fallbackStorage.increment');
  });
});
