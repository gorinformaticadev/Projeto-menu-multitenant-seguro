import { ConfigResolverService } from './config-resolver.service';
import { SystemSettingsReadService } from './system-settings-read.service';
import { SettingsRegistry } from './settings-registry.service';

describe('SystemSettingsReadService', () => {
  const makeDefinition = (overrides: Partial<ReturnType<SettingsRegistry['getOrThrow']>>) => ({
    key: 'security.module_upload.enabled',
    type: 'boolean' as const,
    defaultValue: false,
    label: 'Upload de modulos',
    description: 'Permite instalar ou bloquear o upload de modulos no sistema.',
    category: 'security',
    envKey: 'ENABLE_MODULE_UPLOAD',
    restartRequired: false,
    sensitive: false,
    requiresConfirmation: true,
    allowedInPanel: true,
    editableInPanel: true,
    validator: (value: boolean) => typeof value === 'boolean',
    ...overrides,
  });

  const createService = () => {
    const definitions = [
      makeDefinition({ key: 'security.module_upload.enabled', sensitive: false, label: 'Upload de modulos' }),
      makeDefinition({
        key: 'security.headers.enabled',
        sensitive: true,
        editableInPanel: false,
        label: 'Headers de seguranca',
      }),
      makeDefinition({
        key: 'internal.only',
        allowedInPanel: false,
        editableInPanel: false,
        label: 'Internal only',
      }),
    ];

    const registryMock = {
      getAllowedInPanel: jest.fn(() => definitions.filter((item) => item.allowedInPanel)),
    } as unknown as SettingsRegistry;

    const resolverMock = {
      getResolved: jest.fn(async (key: string) => {
        if (key === 'security.module_upload.enabled') {
          return {
            key,
            value: true,
            source: 'database',
          };
        }

        return {
          key,
          value: false,
          source: 'env',
        };
      }),
    } as unknown as ConfigResolverService;

    const prismaMock = {
      systemSetting: {
        findMany: jest.fn(async () => [
          {
            key: 'security.module_upload.enabled',
            updatedAt: new Date('2026-03-13T12:00:00.000Z'),
            updatedByUserId: 'user-1',
          },
          {
            key: 'security.headers.enabled',
            updatedAt: new Date('2026-03-13T12:05:00.000Z'),
            updatedByUserId: null,
          },
        ]),
      },
      user: {
        findMany: jest.fn(async () => [
          {
            id: 'user-1',
            email: 'admin@example.com',
            name: 'Admin User',
          },
        ]),
      },
    };

    return {
      resolverMock,
      prismaMock,
      service: new SystemSettingsReadService(registryMock, resolverMock, prismaMock as any),
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lista apenas chaves aprovadas para painel', async () => {
    const { service } = createService();

    const result = await service.listPanelSettings();

    expect(result.data.map((item) => item.key).sort()).toEqual(
      ['security.headers.enabled', 'security.module_upload.enabled'].sort(),
    );
  });

  it('retorna origem resolvida e metadados para futura UI', async () => {
    const { service } = createService();

    const result = await service.listPanelSettings();
    const item = result.data.find((entry) => entry.key === 'security.module_upload.enabled');

    expect(item).toEqual(
      expect.objectContaining({
        key: 'security.module_upload.enabled',
        label: 'Upload de modulos',
        category: 'security',
        type: 'boolean',
        allowedInPanel: true,
        editableInPanel: true,
        requiresConfirmation: true,
        resolvedValue: true,
        resolvedSource: 'database',
        hasDatabaseOverride: true,
        lastUpdatedAt: '2026-03-13T12:00:00.000Z',
        lastUpdatedBy: {
          userId: 'user-1',
          email: 'admin@example.com',
          name: 'Admin User',
        },
      }),
    );
    expect(result.meta).toEqual({
      total: 2,
      categories: ['security'],
    });
  });

  it('nao expoe valor de configuracao marcada como sensivel', async () => {
    const { service } = createService();

    const result = await service.listPanelSettings();
    const item = result.data.find((entry) => entry.key === 'security.headers.enabled');

    expect(item).toEqual(
      expect.objectContaining({
        sensitive: true,
        valueHidden: true,
        editableInPanel: false,
        resolvedValue: null,
        resolvedSource: 'env',
      }),
    );
  });

  it('continua respondendo em modo fail-open quando banco de overrides falha', async () => {
    const { service, prismaMock } = createService();
    prismaMock.systemSetting.findMany.mockRejectedValueOnce(new Error('db offline'));

    const result = await service.listPanelSettings();
    const item = result.data.find((entry) => entry.key === 'security.module_upload.enabled');

    expect(item).toEqual(
      expect.objectContaining({
        resolvedSource: 'database',
        hasDatabaseOverride: false,
        lastUpdatedAt: null,
        lastUpdatedBy: null,
      }),
    );
  });

  it('continua respondendo sem ator quando leitura de usuario falha', async () => {
    const { service, prismaMock } = createService();
    prismaMock.user.findMany.mockRejectedValueOnce(new Error('users offline'));

    const result = await service.listPanelSettings();
    const item = result.data.find((entry) => entry.key === 'security.module_upload.enabled');

    expect(item).toEqual(
      expect.objectContaining({
        hasDatabaseOverride: true,
        lastUpdatedBy: {
          userId: 'user-1',
          email: null,
          name: null,
        },
      }),
    );
  });
});
