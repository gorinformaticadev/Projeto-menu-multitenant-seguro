import { CronService } from '@core/cron/cron.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { TokenCleanupService } from './token-cleanup.service';

describe('TokenCleanupService', () => {
  const prismaMock = {
    refreshToken: {
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };

  const cronServiceMock = {
    register: jest.fn(),
  };

  const createService = () =>
    new TokenCleanupService(
      prismaMock as unknown as PrismaService,
      cronServiceMock as unknown as CronService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    cronServiceMock.register.mockResolvedValue(undefined);
    prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('registers the token cleanup job in the dynamic cron runtime', async () => {
    const service = createService();

    await service.onModuleInit();

    expect(cronServiceMock.register).toHaveBeenCalledWith(
      'system.token_cleanup',
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({
        name: 'Token cleanup',
        origin: 'core',
        settingsUrl: '/configuracoes/sistema/cron',
      }),
    );
  });
});
