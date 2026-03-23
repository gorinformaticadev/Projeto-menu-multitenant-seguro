import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { SettingsRegistry } from '../../system-settings/settings-registry.service';
import { CsrfGuard, SKIP_CSRF_KEY } from './csrf.guard';

type StoredSettingRecord = {
  key: string;
  valueJson: unknown;
};

type InMemoryPrisma = {
  store: Map<string, StoredSettingRecord>;
  systemSetting: {
    findUnique: jest.Mock<Promise<any>, [any]>;
  };
};

const applyDatabaseOverride = (prisma: InMemoryPrisma, key: string, value: boolean) => {
  prisma.store.set(key, {
    key,
    valueJson: value,
  });
};

const restoreDatabaseFallback = (prisma: InMemoryPrisma, key: string) => {
  prisma.store.delete(key);
};

const createInMemoryPrisma = (settingsDatabaseAvailable = true): InMemoryPrisma => {
  const store = new Map<string, StoredSettingRecord>();

  const systemSettingFindUnique = jest.fn(async (args: any) => {
    if (!settingsDatabaseAvailable) {
      throw new Error('dynamic settings db offline');
    }

    const record = store.get(args?.where?.key);
    if (!record) {
      return null;
    }

    return {
      key: record.key,
      valueJson: record.valueJson,
    };
  });

  return {
    store,
    systemSetting: {
      findUnique: systemSettingFindUnique,
    },
  };
};

const createExecutionContext = (options?: {
  method?: string;
  origin?: string;
  referer?: string;
  cookies?: Record<string, any>;
  headers?: Record<string, any>;
  skipCsrf?: boolean;
}) => {
  const handler = () => undefined;
  const controller = class TestController {};

  if (options?.skipCsrf) {
    Reflect.defineMetadata(SKIP_CSRF_KEY, true, handler);
  }

  const request: Record<string, any> = {
    method: options?.method ?? 'POST',
    ip: '10.0.0.10',
    url: '/api/test',
    headers: {
      origin: options?.origin,
      referer: options?.referer,
      'user-agent': 'jest',
      ...(options?.headers ?? {}),
    },
    cookies: options?.cookies ?? {},
  };

  const response = {
    cookie: jest.fn(),
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => handler,
    getClass: () => controller,
  };

  return {
    context: context as any,
    request,
    response,
  };
};

const createGuard = (prisma = createInMemoryPrisma(true)) => {
  const registry = new SettingsRegistry();
  const resolver = new ConfigResolverService(registry, prisma as any);

  return {
    prisma,
    resolver,
    guard: new CsrfGuard(new Reflector(), resolver),
  };
};

describe('CsrfGuard dynamic setting', () => {
  const originalEnvValue = process.env.CSRF_PROTECTION_ENABLED;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    delete process.env.CSRF_PROTECTION_ENABLED;
    process.env.FRONTEND_URL = 'https://app.example.com';
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  afterAll(() => {
    if (originalEnvValue === undefined) {
      delete process.env.CSRF_PROTECTION_ENABLED;
    } else {
      process.env.CSRF_PROTECTION_ENABLED = originalEnvValue;
    }

    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('uses the default setting to keep CSRF protection enabled', async () => {
    const { guard } = createGuard();
    const http = createExecutionContext({
      method: 'POST',
      origin: 'https://evil.example.com',
    });

    await expect(guard.canActivate(http.context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(http.response.cookie).not.toHaveBeenCalled();
  });

  it('falls back to ENV when no database override exists', async () => {
    process.env.CSRF_PROTECTION_ENABLED = 'true';
    const { guard } = createGuard();
    const http = createExecutionContext({
      method: 'GET',
      origin: 'https://app.example.com',
    });

    await expect(guard.canActivate(http.context)).resolves.toBe(true);
    expect(http.response.cookie).toHaveBeenCalledWith(
      'XSRF-TOKEN',
      expect.any(String),
      expect.objectContaining({
        httpOnly: false,
        secure: true,
        sameSite: 'strict',
      }),
    );
  });

  it('enforces CSRF validation when enabled', async () => {
    process.env.CSRF_PROTECTION_ENABLED = 'true';
    const { guard } = createGuard();
    const http = createExecutionContext({
      method: 'POST',
      origin: 'https://app.example.com',
    });

    await expect(guard.canActivate(http.context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies a database override and restores the env fallback', async () => {
    process.env.CSRF_PROTECTION_ENABLED = 'false';
    const prisma = createInMemoryPrisma(true);

    applyDatabaseOverride(prisma, 'security.csrf.enabled', true);

    const enabledContext = createGuard(prisma);
    const enabledHttp = createExecutionContext({
      method: 'GET',
      origin: 'https://app.example.com',
    });

    await expect(enabledContext.guard.canActivate(enabledHttp.context)).resolves.toBe(true);
    expect(enabledHttp.response.cookie).toHaveBeenCalled();

    restoreDatabaseFallback(prisma, 'security.csrf.enabled');

    const restoredContext = createGuard(prisma);
    const restoredHttp = createExecutionContext({
      method: 'POST',
      origin: 'https://evil.example.com',
    });

    await expect(restoredContext.guard.canActivate(restoredHttp.context)).resolves.toBe(true);
    expect(restoredHttp.response.cookie).not.toHaveBeenCalled();
  });

  it('keeps fail-open behavior when the dynamic settings store is unavailable by falling back to default or ENV', async () => {
    const defaultContext = createGuard(createInMemoryPrisma(false));
    const defaultHttp = createExecutionContext({
      method: 'POST',
      origin: 'https://evil.example.com',
    });

    await expect(defaultContext.guard.canActivate(defaultHttp.context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    process.env.CSRF_PROTECTION_ENABLED = 'true';
    const envContext = createGuard(createInMemoryPrisma(false));
    const envHttp = createExecutionContext({
      method: 'GET',
      origin: 'https://app.example.com',
    });

    await expect(envContext.guard.canActivate(envHttp.context)).resolves.toBe(true);
    expect(envHttp.response.cookie).toHaveBeenCalled();
  });

  it('preserves explicit skipCsrf route exceptions when the guard is enabled', async () => {
    process.env.CSRF_PROTECTION_ENABLED = 'true';
    const { guard } = createGuard();
    const http = createExecutionContext({
      method: 'POST',
      origin: 'https://evil.example.com',
      skipCsrf: true,
    });

    await expect(guard.canActivate(http.context)).resolves.toBe(true);
    expect(http.response.cookie).not.toHaveBeenCalled();
  });

  it('reads only the CSRF dynamic key and stays separate from headers and CSP toggles', async () => {
    const configResolver = {
      getBoolean: jest.fn().mockResolvedValue(false),
    };
    const guard = new CsrfGuard(new Reflector(), configResolver as any);
    const http = createExecutionContext({
      method: 'POST',
      origin: 'https://evil.example.com',
    });

    await expect(guard.canActivate(http.context)).resolves.toBe(true);
    expect(configResolver.getBoolean).toHaveBeenCalledWith('security.csrf.enabled');
    expect(configResolver.getBoolean).not.toHaveBeenCalledWith('security.headers.enabled');
    expect(configResolver.getBoolean).not.toHaveBeenCalledWith('security.csp_advanced.enabled');
  });
});
