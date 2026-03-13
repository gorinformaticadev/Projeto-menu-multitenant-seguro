import { PrismaService } from '@core/prisma/prisma.service';
import { SettingsRegistry } from './settings-registry.service';
import { SystemSettingsBootstrapService } from './system-settings-bootstrap.service';

describe('SystemSettingsBootstrapService', () => {
  const registry = new SettingsRegistry();
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  const createStatefulService = () => {
    const store = new Map<string, any>();
    const prismaMock = {
      systemSetting: {
        findUnique: jest.fn(async ({ where }: { where: { key: string } }) => store.get(where.key) ?? null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const created = { id: `id-${String(data.key)}`, ...data };
          store.set(String(data.key), created);
          return created;
        }),
      },
    } as unknown as PrismaService;

    return {
      store,
      prismaMock,
      service: new SystemSettingsBootstrapService(registry, prismaMock),
    };
  };

  it('cria registros apenas quando ausentes', async () => {
    const { service, prismaMock } = createStatefulService();
    process.env.ENABLE_MODULE_UPLOAD = 'true';
    process.env.SECURITY_HEADERS_ENABLED = 'false';

    await service.bootstrapFromEnv();

    expect((prismaMock as any).systemSetting.create).toHaveBeenCalledTimes(2);
  });

  it('nao sobrescreve registros existentes', async () => {
    const { service, store, prismaMock } = createStatefulService();
    store.set('security.module_upload.enabled', {
      id: 'existing',
      key: 'security.module_upload.enabled',
      valueJson: false,
    });
    process.env.ENABLE_MODULE_UPLOAD = 'true';

    await service.bootstrapFromEnv();

    expect((prismaMock as any).systemSetting.create).not.toHaveBeenCalled();
    expect(store.get('security.module_upload.enabled').valueJson).toBe(false);
  });

  it('usa ENV apenas para chaves whitelistadas', async () => {
    const { service, prismaMock } = createStatefulService();
    process.env.RATE_LIMITING_ENABLED = 'false';
    process.env.NON_WHITELISTED_FLAG = 'true';

    await service.bootstrapFromEnv();

    const createdKeys = (((prismaMock as any).systemSetting.create as jest.Mock).mock.calls).map(
      ([payload]) => payload.data.key,
    );

    expect(createdKeys).toContain('security.rate_limit.enabled');
    expect(createdKeys).not.toContain('NON_WHITELISTED_FLAG');
  });

  it('falha sem derrubar o fluxo', async () => {
    const prismaMock = {
      systemSetting: {
        findUnique: jest.fn().mockRejectedValue(new Error('db offline')),
        create: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = new SystemSettingsBootstrapService(registry, prismaMock);
    process.env.ENABLE_MODULE_UPLOAD = 'true';

    await expect(service.bootstrapFromEnv()).resolves.toBeUndefined();
  });

  it('e idempotente', async () => {
    const { service, prismaMock } = createStatefulService();
    process.env.ENABLE_FILE_SIGNATURE_VALIDATION = 'true';

    await service.bootstrapFromEnv();
    await service.bootstrapFromEnv();

    expect((prismaMock as any).systemSetting.create).toHaveBeenCalledTimes(1);
  });
});
