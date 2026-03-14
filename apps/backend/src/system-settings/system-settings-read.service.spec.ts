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
    operationalNotes: [],
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
        sensitive: false,
        editableInPanel: false,
        restartRequired: true,
        operationalNotes: [
          'Mudancas nesta chave so passam a valer apos reiniciar o processo do backend.',
        ],
        label: 'Headers de seguranca',
      }),
      makeDefinition({
        key: 'security.csrf.enabled',
        sensitive: false,
        editableInPanel: false,
        restartRequired: false,
        operationalNotes: [
          'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do guard.',
          'Quando habilitado, clientes reais precisam enviar cookie e header CSRF validos ou podem receber 403.',
          'Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura devido ao risco operacional.',
        ],
        label: 'Protecao CSRF',
      }),
      makeDefinition({
        key: 'security.websocket.enabled',
        sensitive: false,
        editableInPanel: false,
        restartRequired: false,
        description: 'Ativa ou desativa o canal Socket.IO dos gateways realtime ativos do backend.',
        operationalNotes: [
          'Nesta etapa controla apenas os gateways Socket.IO ativos do backend. SSE e outros canais realtime continuam fora deste escopo.',
          'Conexoes ja abertas e ociosas podem permanecer ate nova interacao, emissao ou reconexao; este toggle nao faz dreno global instantaneo.',
          'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do resolvedor.',
          'Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura devido ao limite operacional do canal.',
        ],
        label: 'Canal WebSocket realtime',
      }),
      makeDefinition({
        key: 'security.csp_advanced.enabled',
        sensitive: false,
        editableInPanel: false,
        restartRequired: false,
        description: 'Ativa a politica CSP avancada aplicada pelo middleware global do backend.',
        operationalNotes: [
          'Controla apenas a sobrescrita da CSP avancada no CspMiddleware global. A CSP basica de security.headers.enabled continua separada.',
          'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do middleware.',
          'Quando habilitado, paginas e clientes reais podem falhar ao carregar scripts, estilos, imagens ou conexoes que nao estejam cobertos pela politica atual.',
          'Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura devido ao risco operacional para o frontend real.',
        ],
        label: 'CSP avancado',
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
          {
            key: 'security.csrf.enabled',
            updatedAt: new Date('2026-03-13T12:10:00.000Z'),
            updatedByUserId: null,
          },
          {
            key: 'security.websocket.enabled',
            updatedAt: new Date('2026-03-13T12:15:00.000Z'),
            updatedByUserId: null,
          },
          {
            key: 'security.csp_advanced.enabled',
            updatedAt: new Date('2026-03-13T12:20:00.000Z'),
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
      [
        'security.csrf.enabled',
        'security.csp_advanced.enabled',
        'security.headers.enabled',
        'security.module_upload.enabled',
        'security.websocket.enabled',
      ].sort(),
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
        operationalNotes: [],
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
      total: 5,
      categories: ['security'],
    });
  });

  it('nao expoe valor de configuracao marcada como sensivel', async () => {
    const { resolverMock, prismaMock } = createService();
    const registryMock = {
      getAllowedInPanel: jest.fn(() => [
        makeDefinition({
          key: 'security.internal.protected.enabled',
          label: 'Controle protegido',
          sensitive: true,
          editableInPanel: false,
        }),
      ]),
    } as unknown as SettingsRegistry;

    (resolverMock.getResolved as jest.Mock).mockResolvedValue({
      key: 'security.internal.protected.enabled',
      value: false,
      source: 'env',
    });
    prismaMock.systemSetting.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);

    const service = new SystemSettingsReadService(registryMock, resolverMock, prismaMock as any);
    const result = await service.listPanelSettings();
    const item = result.data[0];

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

  it('mantem security.headers.enabled visivel, somente leitura e com reinicio explicito', async () => {
    const { service } = createService();

    const result = await service.listPanelSettings();
    const item = result.data.find((entry) => entry.key === 'security.headers.enabled');

    expect(item).toEqual(
      expect.objectContaining({
        key: 'security.headers.enabled',
        sensitive: false,
        valueHidden: false,
        editableInPanel: false,
        restartRequired: true,
        resolvedValue: false,
        resolvedSource: 'env',
        operationalNotes: [
          'Mudancas nesta chave so passam a valer apos reiniciar o processo do backend.',
        ],
      }),
    );
  });

  it('mantem security.csrf.enabled visivel, somente leitura e com risco operacional explicito', async () => {
    const { service } = createService();

    const result = await service.listPanelSettings();
    const item = result.data.find((entry) => entry.key === 'security.csrf.enabled');

    expect(item).toEqual(
      expect.objectContaining({
        key: 'security.csrf.enabled',
        sensitive: false,
        valueHidden: false,
        editableInPanel: false,
        restartRequired: false,
        resolvedValue: false,
        resolvedSource: 'env',
        operationalNotes: expect.arrayContaining([
          expect.stringMatching(/15 segundos/i),
          expect.stringMatching(/403/i),
          expect.stringMatching(/somente leitura/i),
        ]),
      }),
    );
  });

  it('mantem security.websocket.enabled visivel, somente leitura e com limite operacional explicito', async () => {
    const { service } = createService();

    const result = await service.listPanelSettings();
    const item = result.data.find((entry) => entry.key === 'security.websocket.enabled');

    expect(item).toEqual(
      expect.objectContaining({
        key: 'security.websocket.enabled',
        label: 'Canal WebSocket realtime',
        description: 'Ativa ou desativa o canal Socket.IO dos gateways realtime ativos do backend.',
        sensitive: false,
        valueHidden: false,
        editableInPanel: false,
        restartRequired: false,
        resolvedValue: false,
        resolvedSource: 'env',
        operationalNotes: expect.arrayContaining([
          expect.stringMatching(/Socket\.IO ativos/i),
          expect.stringMatching(/dreno global instantaneo/i),
          expect.stringMatching(/15 segundos/i),
          expect.stringMatching(/somente leitura/i),
        ]),
      }),
    );
  });

  it('mantem security.csp_advanced.enabled visivel, somente leitura e com risco operacional explicito para o frontend', async () => {
    const { service } = createService();

    const result = await service.listPanelSettings();
    const item = result.data.find((entry) => entry.key === 'security.csp_advanced.enabled');

    expect(item).toEqual(
      expect.objectContaining({
        key: 'security.csp_advanced.enabled',
        label: 'CSP avancado',
        description: 'Ativa a politica CSP avancada aplicada pelo middleware global do backend.',
        sensitive: false,
        valueHidden: false,
        editableInPanel: false,
        restartRequired: false,
        resolvedValue: false,
        resolvedSource: 'env',
        operationalNotes: expect.arrayContaining([
          expect.stringMatching(/CspMiddleware global/i),
          expect.stringMatching(/security\.headers\.enabled continua separada/i),
          expect.stringMatching(/15 segundos/i),
          expect.stringMatching(/paginas e clientes reais podem falhar/i),
          expect.stringMatching(/somente leitura/i),
        ]),
      }),
    );
  });

  it('propaga notas operacionais e nao oculta valor de chave somente leitura nao sensivel', async () => {
    const { resolverMock, prismaMock } = createService();
    const registryMock = {
      getAllowedInPanel: jest.fn(() => [
        makeDefinition({
          key: 'security.rate_limit.enabled',
          label: 'Rate limit global',
          description: 'Ativa ou desativa o rate limit global do backend.',
          operationalNotes: ['Cada processo pode levar ate 15 segundos para refletir a mudanca.'],
          sensitive: false,
          editableInPanel: false,
        }),
      ]),
    } as unknown as SettingsRegistry;

    (resolverMock.getResolved as jest.Mock).mockResolvedValue({
      key: 'security.rate_limit.enabled',
      value: false,
      source: 'env',
    });
    prismaMock.systemSetting.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);

    const service = new SystemSettingsReadService(registryMock, resolverMock, prismaMock as any);
    const result = await service.listPanelSettings();

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        key: 'security.rate_limit.enabled',
        editableInPanel: false,
        sensitive: false,
        valueHidden: false,
        resolvedValue: false,
        operationalNotes: ['Cada processo pode levar ate 15 segundos para refletir a mudanca.'],
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
