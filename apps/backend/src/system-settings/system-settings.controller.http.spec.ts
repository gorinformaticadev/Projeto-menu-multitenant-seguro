import { CanActivate, ExecutionContext, INestApplication, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as request from 'supertest';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { PrismaService } from '@core/prisma/prisma.service';
import { SystemSettingsModule } from './system-settings.module';
import { SystemSettingsReadService } from './system-settings-read.service';
import { SystemSettingsWriteService } from './system-settings-write.service';

@Injectable()
class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const roleHeader = request.headers['x-test-role'];

    request.user = {
      id: 'super-admin-user',
      sub: 'super-admin-user',
      email: 'super-admin@example.com',
      role: typeof roleHeader === 'string' ? roleHeader : Role.USER,
    };

    return true;
  }
}

describe('SystemSettingsController HTTP', () => {
  let app: INestApplication;

  const prismaMock = {
    systemSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(null),
    },
  };

  const readServiceMock = {
    listPanelSettings: jest.fn().mockResolvedValue({
      data: [
        {
          key: 'security.module_upload.enabled',
          label: 'Upload de modulos',
          description: 'Permite instalar ou bloquear o upload de modulos no sistema.',
          operationalNotes: [],
          category: 'security',
          type: 'boolean',
          allowedInPanel: true,
          editableInPanel: true,
          restartRequired: false,
          requiresConfirmation: true,
          sensitive: false,
          valueHidden: false,
          resolvedValue: true,
          resolvedSource: 'env',
          hasDatabaseOverride: false,
          lastUpdatedAt: null,
          lastUpdatedBy: null,
        },
        {
          key: 'security.csrf.enabled',
          label: 'Protecao CSRF',
          description: 'Ativa a validacao CSRF global do backend para requests mutaveis.',
          operationalNotes: [
            'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do guard.',
            'Quando habilitado, clientes reais precisam enviar cookie e header CSRF validos ou podem receber 403.',
            'Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura devido ao risco operacional.',
          ],
          category: 'security',
          type: 'boolean',
          allowedInPanel: true,
          editableInPanel: false,
          restartRequired: false,
          requiresConfirmation: false,
          sensitive: false,
          valueHidden: false,
          resolvedValue: false,
          resolvedSource: 'env',
          hasDatabaseOverride: false,
          lastUpdatedAt: null,
          lastUpdatedBy: null,
        },
        {
          key: 'security.rate_limit.advanced.enabled',
          label: 'Rate limit avancado',
          description:
            'Controla apenas os reforcos avancados do rate limiting global para rotas sensiveis, alto volume e trafego autenticado.',
          operationalNotes: [
            'Controla apenas os reforcos avancados aplicados pelo SecurityThrottlerGuard. O rate limit global/base continua separado em security.rate_limit.enabled.',
            'Rotas com @Throttle explicito continuam usando suas proprias politicas e nao passam a obedecer este toggle automaticamente.',
            'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do snapshot local do guard.',
            'Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura.',
          ],
          category: 'security',
          type: 'boolean',
          allowedInPanel: true,
          editableInPanel: false,
          restartRequired: false,
          requiresConfirmation: false,
          sensitive: false,
          valueHidden: false,
          resolvedValue: true,
          resolvedSource: 'database',
          hasDatabaseOverride: true,
          lastUpdatedAt: '2026-03-13T12:07:00.000Z',
          lastUpdatedBy: {
            userId: 'super-admin-user',
            email: 'super-admin@example.com',
            name: null,
          },
        },
        {
          key: 'security.websocket.enabled',
          label: 'Canal WebSocket realtime',
          description: 'Ativa ou desativa o canal Socket.IO dos gateways realtime ativos do backend.',
          operationalNotes: [
            'Nesta etapa controla apenas os gateways Socket.IO ativos do backend. SSE e outros canais realtime continuam fora deste escopo.',
            'Conexoes ja abertas e ociosas podem permanecer ate nova interacao, emissao ou reconexao; este toggle nao faz dreno global instantaneo.',
            'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do resolvedor.',
            'Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura devido ao limite operacional do canal.',
          ],
          category: 'security',
          type: 'boolean',
          allowedInPanel: true,
          editableInPanel: false,
          restartRequired: false,
          requiresConfirmation: false,
          sensitive: false,
          valueHidden: false,
          resolvedValue: true,
          resolvedSource: 'database',
          hasDatabaseOverride: true,
          lastUpdatedAt: '2026-03-13T12:15:00.000Z',
          lastUpdatedBy: {
            userId: 'super-admin-user',
            email: 'super-admin@example.com',
            name: null,
          },
        },
        {
          key: 'security.csp_advanced.enabled',
          label: 'CSP avancado',
          description: 'Ativa a politica CSP avancada aplicada pelo middleware global do backend.',
          operationalNotes: [
            'Controla apenas a sobrescrita da CSP avancada no CspMiddleware global. A CSP basica de security.headers.enabled continua separada.',
            'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do middleware.',
            'Quando habilitado, paginas e clientes reais podem falhar ao carregar scripts, estilos, imagens ou conexoes que nao estejam cobertos pela politica atual.',
            'Nesta fase o painel exibe o estado atual, mas mantem esta chave como somente leitura devido ao risco operacional para o frontend real.',
          ],
          category: 'security',
          type: 'boolean',
          allowedInPanel: true,
          editableInPanel: false,
          restartRequired: false,
          requiresConfirmation: false,
          sensitive: false,
          valueHidden: false,
          resolvedValue: false,
          resolvedSource: 'env',
          hasDatabaseOverride: false,
          lastUpdatedAt: null,
          lastUpdatedBy: null,
        },
      ],
      meta: {
        total: 5,
        categories: ['security'],
      },
    }),
  };
  const writeServiceMock = {
    updatePanelSetting: jest.fn().mockResolvedValue({
      action: 'update',
      setting: {
        key: 'notifications.enabled',
        label: 'Notificacoes do sistema',
        description: 'Ativa ou desativa o envio de notificacoes do sistema.',
        operationalNotes: [],
        category: 'notifications',
        type: 'boolean',
        allowedInPanel: true,
        editableInPanel: true,
        restartRequired: false,
        requiresConfirmation: false,
        sensitive: false,
        valueHidden: false,
        resolvedValue: false,
        resolvedSource: 'database',
        hasDatabaseOverride: true,
        lastUpdatedAt: '2026-03-13T16:00:00.000Z',
        lastUpdatedBy: {
          userId: 'super-admin-user',
          email: 'super-admin@example.com',
          name: null,
        },
      },
    }),
    restorePanelSettingFallback: jest.fn().mockResolvedValue({
      action: 'restore_fallback',
      setting: {
        key: 'notifications.enabled',
        label: 'Notificacoes do sistema',
        description: 'Ativa ou desativa o envio de notificacoes do sistema.',
        operationalNotes: [],
        category: 'notifications',
        type: 'boolean',
        allowedInPanel: true,
        editableInPanel: true,
        restartRequired: false,
        requiresConfirmation: false,
        sensitive: false,
        valueHidden: false,
        resolvedValue: true,
        resolvedSource: 'env',
        hasDatabaseOverride: false,
        lastUpdatedAt: null,
        lastUpdatedBy: null,
      },
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      imports: [SystemSettingsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(SystemSettingsReadService)
      .useValue(readServiceMock)
      .overrideProvider(SystemSettingsWriteService)
      .useValue(writeServiceMock)
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('permite acesso para SUPER_ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/system/settings/panel')
      .set('x-test-role', Role.SUPER_ADMIN)
      .expect(200)
      .expect(({ body }) => {
        expect(body.meta.total).toBe(5);
        expect(body.data.map((item: { key: string }) => item.key).sort()).toEqual(
          [
            'security.csp_advanced.enabled',
            'security.csrf.enabled',
            'security.module_upload.enabled',
            'security.rate_limit.advanced.enabled',
            'security.websocket.enabled',
          ].sort(),
        );
        expect(body.data.find((item: { key: string }) => item.key === 'security.csrf.enabled')).toEqual(
          expect.objectContaining({
            editableInPanel: false,
            restartRequired: false,
            requiresConfirmation: false,
            sensitive: false,
            valueHidden: false,
            operationalNotes: expect.arrayContaining([
              expect.stringMatching(/15 segundos/i),
              expect.stringMatching(/403/i),
              expect.stringMatching(/somente leitura/i),
            ]),
          }),
        );
        expect(body.data.find((item: { key: string }) => item.key === 'security.rate_limit.advanced.enabled')).toEqual(
          expect.objectContaining({
            editableInPanel: false,
            restartRequired: false,
            requiresConfirmation: false,
            sensitive: false,
            valueHidden: false,
            description: expect.stringMatching(/reforcos avancados do rate limiting global/i),
            operationalNotes: expect.arrayContaining([
              expect.stringMatching(/SecurityThrottlerGuard/i),
              expect.stringMatching(/security\.rate_limit\.enabled/i),
              expect.stringMatching(/@Throttle explicito/i),
              expect.stringMatching(/15 segundos/i),
              expect.stringMatching(/somente leitura/i),
            ]),
          }),
        );
        expect(body.data.find((item: { key: string }) => item.key === 'security.websocket.enabled')).toEqual(
          expect.objectContaining({
            editableInPanel: false,
            restartRequired: false,
            requiresConfirmation: false,
            sensitive: false,
            valueHidden: false,
            description: expect.stringMatching(/Socket\.IO/i),
            operationalNotes: expect.arrayContaining([
              expect.stringMatching(/Socket\.IO ativos/i),
              expect.stringMatching(/dreno global instantaneo/i),
              expect.stringMatching(/15 segundos/i),
              expect.stringMatching(/somente leitura/i),
            ]),
          }),
        );
        expect(body.data.find((item: { key: string }) => item.key === 'security.csp_advanced.enabled')).toEqual(
          expect.objectContaining({
            editableInPanel: false,
            restartRequired: false,
            requiresConfirmation: false,
            sensitive: false,
            valueHidden: false,
            description: expect.stringMatching(/middleware global do backend/i),
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
  });

  it('retorna 403 para usuario sem permissao', async () => {
    await request(app.getHttpServer())
      .get('/system/settings/panel')
      .set('x-test-role', Role.ADMIN)
      .expect(403);
  });

  it('explicita no contrato HTTP administrativo o escopo real de notifications.push.enabled', async () => {
    readServiceMock.listPanelSettings.mockResolvedValueOnce({
      data: [
        {
          key: 'notifications.push.enabled',
          label: 'Entrega Web Push',
          description:
            'Controla a tentativa real de envio Web Push para subscriptions ja registradas quando houver VAPID valido.',
          operationalNotes: [
            'Controla apenas a tentativa de entrega push no PushNotificationService. Nao cria nem persiste notificacoes.',
            'Notifications.enabled continua controlando a criacao/persistencia da notificacao, e security.websocket.enabled continua controlando o canal realtime/socket.',
            'Disponibilidade de public key VAPID ou existencia de subscriptions nao equivale a entrega habilitada; se esta chave estiver desligada, o envio push nao e tentado.',
            'Cada processo pode levar ate 15 segundos para refletir a mudanca por causa do cache local do servico.',
          ],
          category: 'notifications',
          type: 'boolean',
          allowedInPanel: true,
          editableInPanel: true,
          restartRequired: false,
          requiresConfirmation: true,
          sensitive: false,
          valueHidden: false,
          resolvedValue: true,
          resolvedSource: 'database',
          hasDatabaseOverride: true,
          lastUpdatedAt: '2026-03-14T12:40:00.000Z',
          lastUpdatedBy: {
            userId: 'super-admin-user',
            email: 'super-admin@example.com',
            name: null,
          },
        },
      ],
      meta: {
        total: 1,
        categories: ['notifications'],
      },
    });

    await request(app.getHttpServer())
      .get('/system/settings/panel')
      .set('x-test-role', Role.SUPER_ADMIN)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data[0]).toEqual(
          expect.objectContaining({
            key: 'notifications.push.enabled',
            label: 'Entrega Web Push',
            editableInPanel: true,
            restartRequired: false,
            requiresConfirmation: true,
            sensitive: false,
            valueHidden: false,
            description: expect.stringMatching(/tentativa real de envio Web Push/i),
            operationalNotes: expect.arrayContaining([
              expect.stringMatching(/PushNotificationService/i),
              expect.stringMatching(/Notifications\.enabled continua controlando a criacao\/persistencia/i),
              expect.stringMatching(/security\.websocket\.enabled continua controlando o canal realtime/i),
              expect.stringMatching(/public key VAPID/i),
              expect.stringMatching(/15 segundos/i),
            ]),
          }),
        );
      });
  });

  it('permite update apenas para SUPER_ADMIN', async () => {
    await request(app.getHttpServer())
      .put('/system/settings/panel/notifications.enabled')
      .set('x-test-role', Role.SUPER_ADMIN)
      .send({
        value: false,
        changeReason: 'disable notifications',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.action).toBe('update');
        expect(body.setting.resolvedSource).toBe('database');
      });
  });

  it('bloqueia update para usuario sem permissao', async () => {
    await request(app.getHttpServer())
      .put('/system/settings/panel/notifications.enabled')
      .set('x-test-role', Role.ADMIN)
      .send({
        value: false,
      })
      .expect(403);
  });

  it('permite restore fallback apenas para SUPER_ADMIN', async () => {
    await request(app.getHttpServer())
      .post('/system/settings/panel/notifications.enabled/restore-fallback')
      .set('x-test-role', Role.SUPER_ADMIN)
      .send({
        changeReason: 'restore env fallback',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.action).toBe('restore_fallback');
        expect(body.setting.resolvedSource).toBe('env');
      });
  });

  it('nao expoe endpoint generico de escrita arbitraria', async () => {
    await request(app.getHttpServer())
      .put('/system/settings/panel')
      .set('x-test-role', Role.SUPER_ADMIN)
      .send({
        key: 'notifications.enabled',
        value: false,
      })
      .expect(404);
  });
});
