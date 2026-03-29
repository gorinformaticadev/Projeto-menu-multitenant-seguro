import {
  CANONICAL_UPDATE_CRON_JOB_KEYS,
  UpdateCronService,
} from './update-cron.service';
import { UpdateService } from './update.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { CronService } from '@core/cron/cron.service';
import { UpdateExecutionFacadeService } from './engine/update-execution.facade.service';
import { UpdateExecutionBridgeService } from './engine/update-execution-bridge.service';

describe('UpdateCronService', () => {
  const updateServiceMock = {
    checkForUpdates: jest.fn(),
  };
  const prismaMock = {
    updateLog: {
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };
  const cronServiceMock = {
    register: jest.fn(),
    suppressJobs: jest.fn(),
  };
  const updateExecutionFacadeServiceMock = {
    getCurrentExecutionView: jest.fn(),
  };
  const updateExecutionBridgeServiceMock = {
    isEnabled: jest.fn(),
    syncCurrentLegacyBridgeExecution: jest.fn(),
  };

  let service: UpdateCronService;

  beforeEach(() => {
    jest.clearAllMocks();
    cronServiceMock.register.mockResolvedValue(undefined);
    cronServiceMock.suppressJobs.mockResolvedValue(undefined);

    service = new UpdateCronService(
      updateServiceMock as unknown as UpdateService,
      prismaMock as unknown as PrismaService,
      cronServiceMock as unknown as CronService,
      updateExecutionFacadeServiceMock as unknown as UpdateExecutionFacadeService,
      updateExecutionBridgeServiceMock as unknown as UpdateExecutionBridgeService,
    );
  });

  it('desativa os jobs canonicos no wiring automatico sem remover sua implementacao', async () => {
    await service.onModuleInit();

    expect(cronServiceMock.suppressJobs).toHaveBeenCalledWith(CANONICAL_UPDATE_CRON_JOB_KEYS);
    expect(cronServiceMock.register).toHaveBeenCalledTimes(2);
    expect(cronServiceMock.register).toHaveBeenNthCalledWith(
      1,
      'system.update_check',
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({
        name: 'Verificar atualizacoes',
      }),
    );
    expect(cronServiceMock.register).toHaveBeenNthCalledWith(
      2,
      'system.log_cleanup',
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({
        name: 'Limpeza de logs',
      }),
    );
    expect(cronServiceMock.register).not.toHaveBeenCalledWith(
      'system.update_canonical_sync',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(cronServiceMock.register).not.toHaveBeenCalledWith(
      'system.update_canonical_cleanup',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(typeof (service as unknown as { registerCanonicalSyncJob?: unknown }).registerCanonicalSyncJob).toBe(
      'function',
    );
    expect(
      typeof (service as unknown as { registerCanonicalCleanupJob?: unknown }).registerCanonicalCleanupJob,
    ).toBe('function');
  });
});
