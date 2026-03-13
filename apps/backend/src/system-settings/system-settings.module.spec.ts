import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SystemTelemetryService } from '@common/services/system-telemetry.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { SystemSettingsModule } from './system-settings.module';

const systemTelemetryServiceMock = {
  recordSecurityEvent: jest.fn(),
  recordRequest: jest.fn(),
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SystemSettingsModule,
  ],
  providers: [
    {
      provide: SystemTelemetryService,
      useValue: systemTelemetryServiceMock,
    },
  ],
})
class SystemSettingsTestAppModule {}

describe('SystemSettingsModule boot integration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  const createPrismaMock = () =>
    ({
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: `id-${String(data.key)}`,
          ...data,
        })),
      },
    }) as unknown as PrismaService;

  it('sobe com ENV apenas', async () => {
    process.env.ENABLE_MODULE_UPLOAD = 'true';
    const prismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [SystemSettingsTestAppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    const app = moduleRef.createNestApplication();
    await expect(app.init()).resolves.toBeDefined();
    await app.close();
  });

  it('sobe com system_settings vazio', async () => {
    delete process.env.ENABLE_MODULE_UPLOAD;
    const prismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [SystemSettingsTestAppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    const app = moduleRef.createNestApplication();
    await expect(app.init()).resolves.toBeDefined();
    await app.close();
  });

  it('sobe com falha no bootstrap', async () => {
    process.env.ENABLE_MODULE_UPLOAD = 'true';
    const prismaMock = {
      systemSetting: {
        findUnique: jest.fn().mockRejectedValue(new Error('db offline')),
        create: jest.fn(),
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      imports: [SystemSettingsTestAppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    const app = moduleRef.createNestApplication();
    await expect(app.init()).resolves.toBeDefined();
    await app.close();
  });
});
