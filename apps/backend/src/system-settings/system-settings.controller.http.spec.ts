import { CanActivate, ExecutionContext, INestApplication, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as request from 'supertest';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { PrismaService } from '@core/prisma/prisma.service';
import { SystemSettingsModule } from './system-settings.module';
import { SystemSettingsReadService } from './system-settings-read.service';

@Injectable()
class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const roleHeader = request.headers['x-test-role'];

    request.user = {
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

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      imports: [SystemSettingsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(SystemSettingsReadService)
      .useValue(readServiceMock)
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
});
