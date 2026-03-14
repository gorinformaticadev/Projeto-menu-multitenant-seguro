import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { SettingsRegistry } from '../../system-settings/settings-registry.service';
import { WebsocketRuntimeToggleService } from './websocket-runtime-toggle.service';

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

const SETTING_KEY = 'security.websocket.enabled';

const createInMemoryPrisma = (settingsDatabaseAvailable = true): InMemoryPrisma => {
  const store = new Map<string, StoredSettingRecord>();

  return {
    store,
    systemSetting: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (!settingsDatabaseAvailable) {
          throw new Error('dynamic settings db offline');
        }

        return store.get(where?.key) ?? null;
      }),
    },
  };
};

describe('WebsocketRuntimeToggleService dynamic websocket toggle', () => {
  const originalWebsocketEnabled = process.env.WEBSOCKET_ENABLED;

  const createContext = (settingsDatabaseAvailable = true) => {
    const prisma = createInMemoryPrisma(settingsDatabaseAvailable);
    const registry = new SettingsRegistry();
    const resolver = new ConfigResolverService(registry, prisma as any);
    const service = new WebsocketRuntimeToggleService(resolver);

    return { prisma, service };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-14T12:00:00.000Z'));
    delete process.env.WEBSOCKET_ENABLED;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    if (originalWebsocketEnabled === undefined) {
      delete process.env.WEBSOCKET_ENABLED;
    } else {
      process.env.WEBSOCKET_ENABLED = originalWebsocketEnabled;
    }
  });

  it('uses the default value when no override exists', async () => {
    const { service } = createContext();

    await expect(service.getToggleStateCached()).resolves.toEqual({
      key: SETTING_KEY,
      enabled: true,
      source: 'default',
    });
    await expect(service.isEnabledCached()).resolves.toBe(true);
  });

  it('uses ENV when present and no database override exists', async () => {
    process.env.WEBSOCKET_ENABLED = 'false';
    const { service } = createContext();

    await expect(service.getToggleStateCached()).resolves.toEqual({
      key: SETTING_KEY,
      enabled: false,
      source: 'env',
    });
  });

  it('prefers the database override and restores fallback after cache expiry', async () => {
    const { prisma, service } = createContext();
    prisma.store.set(SETTING_KEY, {
      key: SETTING_KEY,
      valueJson: false,
    });

    await expect(service.getToggleStateCached()).resolves.toEqual({
      key: SETTING_KEY,
      enabled: false,
      source: 'database',
    });

    prisma.store.delete(SETTING_KEY);

    await expect(service.getToggleStateCached()).resolves.toEqual({
      key: SETTING_KEY,
      enabled: false,
      source: 'database',
    });

    jest.advanceTimersByTime(15001);

    await expect(service.getToggleStateCached()).resolves.toEqual({
      key: SETTING_KEY,
      enabled: true,
      source: 'default',
    });
  });

  it('fails open to ENV and then default when the dynamic settings store is unavailable', async () => {
    process.env.WEBSOCKET_ENABLED = 'false';
    const envContext = createContext(false);

    await expect(envContext.service.getToggleStateCached()).resolves.toEqual({
      key: SETTING_KEY,
      enabled: false,
      source: 'env',
    });

    delete process.env.WEBSOCKET_ENABLED;
    const defaultContext = createContext(false);

    await expect(defaultContext.service.getToggleStateCached()).resolves.toEqual({
      key: SETTING_KEY,
      enabled: true,
      source: 'default',
    });
  });
});
