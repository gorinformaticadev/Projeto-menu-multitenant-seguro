import { PrismaService } from '@core/prisma/prisma.service';
import { ConfigResolverService } from './config-resolver.service';
import { SettingsRegistry } from './settings-registry.service';

describe('ConfigResolverService', () => {
  const registry = new SettingsRegistry();
  const originalEnv = { ...process.env };

  const createService = () => {
    const prismaMock = {
      systemSetting: {
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;

    return {
      prismaMock,
      service: new ConfigResolverService(registry, prismaMock),
    };
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('resolve do banco quando existir', async () => {
    const { service, prismaMock } = createService();
    ((prismaMock as any).systemSetting.findUnique as jest.Mock).mockResolvedValue({
      key: 'security.rate_limit.enabled',
      valueJson: false,
    });
    process.env.RATE_LIMITING_ENABLED = 'true';

    const resolved = await service.getResolved<boolean>('security.rate_limit.enabled');

    expect(resolved).toEqual(
      expect.objectContaining({
        key: 'security.rate_limit.enabled',
        value: false,
        source: 'database',
      }),
    );
  });

  it('resolve do ENV quando banco nao tiver valor', async () => {
    const { service, prismaMock } = createService();
    ((prismaMock as any).systemSetting.findUnique as jest.Mock).mockResolvedValue(null);
    process.env.RATE_LIMITING_ENABLED = 'false';

    const resolved = await service.getResolved<boolean>('security.rate_limit.enabled');

    expect(resolved).toEqual(
      expect.objectContaining({
        value: false,
        source: 'env',
      }),
    );
  });

  it('resolve do default quando banco e ENV nao tiverem valor', async () => {
    const { service, prismaMock } = createService();
    ((prismaMock as any).systemSetting.findUnique as jest.Mock).mockResolvedValue(null);
    delete process.env.NOTIFICATIONS_PUSH_ENABLED;

    const resolved = await service.getResolved<boolean>('notifications.push.enabled');

    expect(resolved).toEqual(
      expect.objectContaining({
        value: false,
        source: 'default',
      }),
    );
  });

  it('cai para ENV/default se banco falhar', async () => {
    const { service, prismaMock } = createService();
    ((prismaMock as any).systemSetting.findUnique as jest.Mock).mockRejectedValue(
      new Error('db offline'),
    );
    process.env.SECURITY_HEADERS_ENABLED = 'false';

    const resolved = await service.getResolved<boolean>('security.headers.enabled');

    expect(resolved).toEqual(
      expect.objectContaining({
        value: false,
        source: 'env',
      }),
    );
  });

  it('ignora chave fora da whitelist', async () => {
    const { service, prismaMock } = createService();

    const resolved = await service.getResolved('database.url');

    expect(resolved).toBeNull();
    expect((prismaMock as any).systemSetting.findUnique).not.toHaveBeenCalled();
  });

  it('trata valor invalido no banco com fallback seguro', async () => {
    const { service, prismaMock } = createService();
    ((prismaMock as any).systemSetting.findUnique as jest.Mock).mockResolvedValue({
      key: 'security.csrf.enabled',
      valueJson: 'not-a-boolean',
    });
    process.env.CSRF_PROTECTION_ENABLED = 'true';

    const resolved = await service.getResolved<boolean>('security.csrf.enabled');

    expect(resolved).toEqual(
      expect.objectContaining({
        value: true,
        source: 'env',
      }),
    );
  });
});
