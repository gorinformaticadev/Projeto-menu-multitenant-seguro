const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const checks = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertCondition(ok, message) {
  checks.push({ ok, message });
}

function mustContain(source, snippet, message) {
  assertCondition(source.includes(snippet), message);
}

function mustNotContain(source, snippet, message) {
  assertCondition(!source.includes(snippet), message);
}

function run() {
  const runtimeConfig = read('apps/backend/src/core/security-config/security-runtime-config.service.ts');
  const redisStorage = read('apps/backend/src/common/services/redis-throttler.storage.ts');
  const throttlerGuard = read('apps/backend/src/common/guards/security-throttler.guard.ts');
  const authService = read('apps/backend/src/auth/auth.service.ts');
  const userSessionService = read('apps/backend/src/auth/user-session.service.ts');
  const seedDefaults = read('apps/backend/prisma/seeds/defaults.ts');
  const defaultUsersSeed = read('apps/backend/prisma/seeds/modules/default-users.seed.ts');
  const backupController = read('apps/backend/src/backup/backup.controller.ts');
  const updateController = read('apps/backend/src/update/update.controller.ts');
  const systemUpdateController = read('apps/backend/src/update/system-update.controller.ts');

  mustContain(
    runtimeConfig,
    "source: 'security_config'",
    'SecurityRuntimeConfigService deve manter security_config como source explicita.',
  );
  mustContain(
    runtimeConfig,
    'this.prisma.securityConfig.findFirst',
    'SecurityRuntimeConfigService deve ler configuracao de security_config.',
  );
  mustNotContain(
    runtimeConfig,
    'this.prisma.systemSetting',
    'SecurityRuntimeConfigService nao deve depender de system_settings para policy de seguranca runtime.',
  );

  mustContain(
    redisStorage,
    "if (this.failureMode === 'strict')",
    'RedisThrottlerStorage deve manter branch de strict mode.',
  );
  mustContain(
    redisStorage,
    'throw new SharedThrottlerStorageUnavailableError',
    'RedisThrottlerStorage deve falhar explicitamente quando strict mode nao pode usar Redis.',
  );

  mustContain(
    throttlerGuard,
    'verifyJwtPayload(token)',
    'SecurityThrottlerGuard deve validar assinatura antes de usar principal do bearer token.',
  );
  mustContain(
    throttlerGuard,
    'this.jwtVerifier.verify',
    'SecurityThrottlerGuard deve verificar JWT no fallback de identidade.',
  );

  mustContain(
    authService,
    'assertRefreshSessionActive',
    'AuthService.refreshTokens deve validar sessao ativa antes de emitir novo refresh.',
  );
  mustContain(
    authService,
    'consumed.count !== 1',
    'AuthService.refreshTokens deve bloquear reuso concorrente de refresh token.',
  );

  mustContain(
    userSessionService,
    "revokeSession(session.id, 'inactive_timeout')",
    'UserSessionService deve revogar sessao inativa no backend.',
  );
  mustContain(
    userSessionService,
    'expiresAt',
    'UserSessionService deve manter ledger stateful com expiresAt.',
  );

  mustNotContain(
    seedDefaults,
    'admin123',
    'defaults.ts nao pode reintroduzir senha fraca hardcoded.',
  );
  mustContain(
    defaultUsersSeed,
    'LEGACY_WEAK_DEFAULT_PASSWORDS',
    'default-users.seed deve manter remediacao automatica para hashes legados fracos.',
  );
  mustContain(
    defaultUsersSeed,
    'hasLegacyWeakDefaultPassword',
    'default-users.seed deve detectar hash legado fraco antes de manter usuario existente.',
  );

  mustContain(
    backupController,
    "@CriticalRateLimit('backup')",
    'Rotas de backup devem manter quota critica dinamica.',
  );
  mustContain(
    backupController,
    "@CriticalRateLimit('restore')",
    'Rotas de restore devem manter quota critica dinamica.',
  );
  mustContain(
    updateController,
    "@CriticalRateLimit('update')",
    'UpdateController.executeUpdate deve manter quota critica dinamica.',
  );
  mustContain(
    systemUpdateController,
    "@CriticalRateLimit('update')",
    'SystemUpdateController deve manter quota critica dinamica para run/rollback.',
  );

  const failed = checks.filter((item) => !item.ok);

  if (failed.length > 0) {
    console.error('SECURITY_REGRESSION_GUARDRAILS_FAILED');
    for (const item of failed) {
      console.error(` - ${item.message}`);
    }
    process.exit(1);
  }

  console.log(`SECURITY_REGRESSION_GUARDRAILS_OK (${checks.length} checks)`);
}

run();
