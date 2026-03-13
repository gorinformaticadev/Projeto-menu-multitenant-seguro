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
      ],
      meta: {
        total: 1,
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
        expect(body.meta.total).toBe(1);
        expect(body.data[0].key).toBe('security.module_upload.enabled');
      });
  });

  it('retorna 403 para usuario sem permissao', async () => {
    await request(app.getHttpServer())
      .get('/system/settings/panel')
      .set('x-test-role', Role.ADMIN)
      .expect(403);
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
