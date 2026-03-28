import { PrismaService } from '@core/prisma/prisma.service';
import { SystemVersionService } from '@common/services/system-version.service';
import { AuditService } from '../audit/audit.service';
import { UpdateService } from './update.service';
import { SystemUpdateAdminService } from './system-update-admin.service';

function createPlatformSimulationService(sequence: Array<Record<string, unknown>>) {
  process.env.ENCRYPTION_KEY = '12345678901234567890123456789012-strong-key-material';

  const prismaMock = {
    updateSystemSettings: {
      findFirst: jest.fn(async () => ({
        id: 'settings-1',
        appVersion: 'v1.0.0',
        gitToken: null,
        gitUsername: 'org',
        gitRepository: 'repo',
        gitReleaseBranch: 'main',
        packageManager: 'native',
        updateCheckEnabled: true,
        updateChannel: 'release',
        lastUpdateCheck: new Date('2026-03-28T12:00:00.000Z'),
        availableVersion: 'v1.2.3',
        updateAvailable: true,
        releaseTag: 'v1.2.3',
        composeFile: 'docker-compose.prod.yml',
        envFile: 'install/.env.production',
        updatedAt: new Date(),
        updatedBy: null,
      })),
      create: jest.fn(async ({ data }) => ({ id: 'settings-1', ...data })),
      update: jest.fn(async ({ data }) => ({ id: 'settings-1', ...data })),
    },
    $queryRaw: jest.fn(async () => []),
    $queryRawUnsafe: jest.fn(async () => []),
    $executeRaw: jest.fn(async () => 1),
    updateLog: {
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(async () => null),
    },
  };

  let cursor = 0;
  const adminMock = {
    getStatus: jest.fn(async () => {
      const index = Math.min(cursor, sequence.length - 1);
      cursor += 1;
      return sequence[index];
    }),
    runUpdate: jest.fn(),
  };

  const service = new UpdateService(
    prismaMock as unknown as PrismaService,
    { log: jest.fn(async () => undefined) } as unknown as AuditService,
    {
      getVersionInfo: jest.fn(() => ({
        version: 'v1.0.0',
        commitSha: 'sha-test',
        buildDate: '2026-03-28T12:00:00.000Z',
      })),
    } as unknown as SystemVersionService,
    adminMock as unknown as SystemUpdateAdminService,
  );

  return service as unknown as UpdateService;
}

function createSimulatedStatus(overrides?: Record<string, unknown>) {
  return {
    status: 'running',
    mode: 'native',
    startedAt: '2026-03-28T12:00:00.000Z',
    finishedAt: null,
    fromVersion: 'v1.0.0',
    toVersion: 'v1.2.3',
    step: 'build_backend',
    progress: 48,
    lock: true,
    lastError: null,
    errorCode: null,
    errorCategory: null,
    errorStage: null,
    exitCode: null,
    userMessage: null,
    technicalMessage: null,
    rollback: { attempted: false, completed: false, reason: null },
    operation: { active: true, operationId: 'op-1', type: 'update' },
    stale: false,
    statePath: '/tmp/update-state.json',
    logPath: '/tmp/update.log',
    persistence: {
      healthy: true,
      source: 'state_file',
      fallbackApplied: false,
      progressKnown: true,
      statePath: '/tmp/update-state.json',
      logPath: '/tmp/update.log',
      issueCode: null,
      message: null,
      technicalMessage: null,
      rawExcerpt: null,
      recoveredStepCode: 'build_backend',
    },
    ...overrides,
  };
}

describe('UpdateService platform simulator', () => {
  it('simula fluxo feliz completo do painel com etapas reais', async () => {
    const service = createPlatformSimulationService([
      createSimulatedStatus(),
      createSimulatedStatus({
        status: 'success',
        finishedAt: '2026-03-28T12:10:00.000Z',
        step: 'completed',
        progress: 100,
        lock: false,
        exitCode: 0,
        operation: { active: false, operationId: 'op-1', type: 'update' },
        persistence: {
          healthy: true,
          source: 'state_file',
          fallbackApplied: false,
          progressKnown: true,
          statePath: '/tmp/update-state.json',
          logPath: '/tmp/update.log',
          issueCode: null,
          message: null,
          technicalMessage: null,
          rawExcerpt: null,
          recoveredStepCode: 'completed',
        },
      }),
    ]);

    const first = await service.getUpdateStatus();
    const second = await service.getUpdateStatus();

    expect(first.updateLifecycle?.currentStep?.code).toBe('build_backend');
    expect(first.updateLifecycle?.currentStep?.label).toBe('Build do backend');
    expect(first.updateLifecycle?.progressPercent).toBe(48);
    expect(second.updateLifecycle?.status).toBe('completed');
  });

  it('simula falha de leitura de estado sem esconder a etapa recuperada', async () => {
    const service = createPlatformSimulationService([
      createSimulatedStatus({
        mode: 'docker',
        step: 'pull_images',
        progress: 0,
        operation: { active: true, operationId: 'op-2', type: 'update' },
        persistence: {
          healthy: false,
          source: 'log_recovery',
          fallbackApplied: true,
          progressKnown: false,
          statePath: '/tmp/update-state.json',
          logPath: '/tmp/update.log',
          issueCode: 'UPDATE_STATUS_PERSISTENCE_ERROR',
          message: 'Falha ao ler o estado persistido da atualizacao.',
          technicalMessage: 'Arquivo update-state.json invalido',
          rawExcerpt: '{INVALID',
          recoveredStepCode: 'pull_images',
        },
      }),
    ]);

    const status = await service.getUpdateStatus();

    expect(status.updateLifecycle?.status).toBe('running');
    expect(status.updateLifecycle?.currentStep?.code).toBe('pull_images');
    expect(status.updateLifecycle?.persistenceError).toMatchObject({
      code: 'UPDATE_STATUS_PERSISTENCE_ERROR',
      userMessage: 'Falha ao ler o estado persistido da atualizacao.',
    });
    expect(status.updateLifecycle?.progressKnown).toBe(false);
  });

  it('simula falha operacional real em etapa conhecida', async () => {
    const service = createPlatformSimulationService([
      createSimulatedStatus({
        status: 'failed',
        finishedAt: '2026-03-28T12:08:00.000Z',
        step: 'migrate',
        progress: 100,
        lock: false,
        lastError: 'prisma migrate deploy falhou',
        errorCode: 'UPDATE_MIGRATE_ERROR',
        errorCategory: 'UPDATE_MIGRATE_ERROR',
        errorStage: 'migrate',
        exitCode: 44,
        userMessage: 'Falha ao aplicar as migrations da nova release.',
        technicalMessage: 'pnpm prisma migrate deploy falhou',
        operation: { active: false, operationId: 'op-3', type: 'update' },
        persistence: {
          healthy: true,
          source: 'state_file',
          fallbackApplied: false,
          progressKnown: true,
          statePath: '/tmp/update-state.json',
          logPath: '/tmp/update.log',
          issueCode: null,
          message: null,
          technicalMessage: null,
          rawExcerpt: null,
          recoveredStepCode: 'migrate',
        },
      }),
    ]);

    const status = await service.getUpdateStatus();

    expect(status.updateLifecycle?.status).toBe('failed');
    expect(status.updateLifecycle?.failedStep?.code).toBe('migrate');
    expect(status.updateLifecycle?.error).toMatchObject({
      code: 'UPDATE_MIGRATE_ERROR',
      exitCode: 44,
    });
  });

  it.each([
    ['build_backend', 'UPDATE_BUILD_BACKEND_ERROR', 41],
    ['build_frontend', 'UPDATE_BUILD_FRONTEND_ERROR', 42],
    ['restart_pm2', 'UPDATE_PM2_START_ERROR', 47],
    ['post_deploy_validation', 'UPDATE_POST_DEPLOY_VALIDATION_ERROR', 48],
  ])(
    'simula falha real na etapa %s preservando etapa e erro',
    async (step, errorCode, exitCode) => {
      const service = createPlatformSimulationService([
        createSimulatedStatus({
          status: 'failed',
          finishedAt: '2026-03-28T12:09:00.000Z',
          step,
          progress: 100,
          lock: false,
          lastError: `${step} falhou`,
          errorCode,
          errorCategory: errorCode,
          errorStage: step,
          exitCode,
          userMessage: `Falha na etapa ${step}.`,
          technicalMessage: `Detalhe tecnico da etapa ${step}.`,
          operation: { active: false, operationId: `op-${step}`, type: 'update' },
          persistence: {
            healthy: true,
            source: 'state_file',
            fallbackApplied: false,
            progressKnown: true,
            statePath: '/tmp/update-state.json',
            logPath: '/tmp/update.log',
            issueCode: null,
            message: null,
            technicalMessage: null,
            rawExcerpt: null,
            recoveredStepCode: step,
          },
        }),
      ]);

      const status = await service.getUpdateStatus();

      expect(status.updateLifecycle?.status).toBe('failed');
      expect(status.updateLifecycle?.failedStep?.code).toBe(step);
      expect(status.updateLifecycle?.error).toMatchObject({
        code: errorCode,
        exitCode,
      });
    },
  );
});
