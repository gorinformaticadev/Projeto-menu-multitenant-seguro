import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { SystemVersionService } from '@common/services/system-version.service';
import { AuditService } from '../audit/audit.service';
import { UpdateExecutionBridgeService } from './engine/update-execution-bridge.service';
import { UpdateExecutionFacadeService } from './engine/update-execution.facade.service';
import { SystemUpdateAdminService } from './system-update-admin.service';
import { UpdateService } from './update.service';

function createService() {
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
        packageManager: 'docker',
        updateCheckEnabled: true,
        updateChannel: 'release',
        lastUpdateCheck: null,
        availableVersion: null,
        updateAvailable: false,
        releaseTag: 'latest',
        composeFile: 'docker-compose.prod.yml',
        envFile: 'install/.env.production',
        updatedAt: new Date(),
        updatedBy: null,
      })),
      create: jest.fn(async ({ data }) => ({ id: 'settings-1', ...data })),
      update: jest.fn(async ({ data }) => ({ id: 'settings-1', ...data })),
    },
    $queryRaw: jest.fn(async () => [
      { column_name: 'id' },
      { column_name: 'gitUsername' },
      { column_name: 'gitRepository' },
      { column_name: 'gitReleaseBranch' },
      { column_name: 'packageManager' },
      { column_name: 'updateCheckEnabled' },
      { column_name: 'updateChannel' },
      { column_name: 'releaseTag' },
      { column_name: 'composeFile' },
      { column_name: 'envFile' },
      { column_name: 'updatedAt' },
      { column_name: 'updatedBy' },
    ]),
    $queryRawUnsafe: jest.fn(async () => []),
    $executeRaw: jest.fn(async () => 1),
    updateLog: {
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }) => ({
        id: 'log-1',
        startedAt: new Date('2026-03-12T00:00:00Z'),
        ...data,
      })),
      update: jest.fn(async ({ where, data }) => ({
        id: where.id,
        startedAt: new Date('2026-03-12T00:00:00Z'),
        ...data,
      })),
      findUnique: jest.fn(async () => null),
    },
  };

  const auditMock = {
    log: jest.fn(async () => undefined),
  };

  const systemVersionMock = {
    getVersionInfo: jest.fn(() => ({
      version: 'v1.0.0',
      commitSha: 'test-sha',
      buildDate: '2026-01-01T00:00:00Z',
    })),
  };

  const systemUpdateAdminServiceMock = {
    runUpdate: jest.fn(async () => ({
      success: true,
      operationId: 'update-123',
      message: 'Update iniciado para versao v1.2.3.',
    })),
    getStatus: jest.fn(async () => ({
      status: 'idle',
      mode: 'docker',
      startedAt: null,
      finishedAt: null,
      fromVersion: 'v1.0.0',
      toVersion: 'unknown',
      step: 'idle',
      progress: 0,
      lock: false,
      lastError: null,
      errorCode: null,
      errorCategory: null,
      errorStage: null,
      exitCode: null,
      userMessage: null,
      technicalMessage: null,
      rollback: {
        attempted: false,
        completed: false,
        reason: null,
      },
      operation: {
        active: false,
        operationId: null,
        type: null,
      },
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
        recoveredStepCode: 'idle',
      },
    })),
  };

  const updateExecutionFacadeServiceMock = {
    requestExecution: jest.fn(async () => ({
      id: 'execution-1',
      installationId: 'host-1',
      requestedBy: 'user-1',
      source: 'panel',
      mode: 'docker',
      currentVersion: 'v1.0.0',
      targetVersion: 'v1.2.3',
      status: 'requested',
      currentStep: 'precheck',
      failedStep: null,
      rollbackPolicy: 'code_only_safe',
      progressUnitsDone: 0,
      progressUnitsTotal: 14,
      error: null,
      metadata: {},
      requestedAt: '2026-03-12T00:00:00.000Z',
      startedAt: null,
      finishedAt: null,
      revision: 1,
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      progressPercent: 0,
      stepsPlanned: [],
    })),
    getCurrentExecutionView: jest.fn(async () => null),
  };

  const updateExecutionBridgeServiceMock = {
    isEnabled: jest.fn(() => false),
    launchLegacyExecution: jest.fn(async () => ({
      operationId: 'bridge-123',
      execution: {
        id: 'execution-1',
      },
    })),
    syncCurrentLegacyBridgeExecution: jest.fn(async (execution: unknown) => execution),
  };

  const service = new UpdateService(
    prismaMock as unknown as PrismaService,
    auditMock as unknown as AuditService,
    systemVersionMock as unknown as SystemVersionService,
    systemUpdateAdminServiceMock as unknown as SystemUpdateAdminService,
    updateExecutionFacadeServiceMock as unknown as UpdateExecutionFacadeService,
    updateExecutionBridgeServiceMock as unknown as UpdateExecutionBridgeService,
  );

  return {
    service: service as unknown as any,
    prismaMock,
    auditMock,
    systemUpdateAdminServiceMock,
    updateExecutionFacadeServiceMock,
    updateExecutionBridgeServiceMock,
  };
}

describe('UpdateService', () => {
  it('repo publico sem token chama git ls-remote --tags', async () => {
    const { service } = createService();
    const calls: Array<{ cmd: string; args: string[] }> = [];

    service.execFileAsync = jest.fn(async (cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      return { stdout: 'hash\trefs/tags/v1.2.3\n', stderr: '' };
    });

    const out = await service.getRemoteTagsOutput('https://github.com/org/repo.git');

    expect(out.includes('refs/tags/v1.2.3')).toBe(true);
    expect(calls).toEqual([
      {
        cmd: 'git',
        args: ['ls-remote', '--tags', 'https://github.com/org/repo.git'],
      },
    ]);
  });

  it('repo privado com token usa http.extraHeader Authorization Bearer', async () => {
    const { service } = createService();
    const calls: Array<{ cmd: string; args: string[] }> = [];

    service.execFileAsync = jest.fn(async (cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      return { stdout: 'hash\trefs/tags/v2.0.0\n', stderr: '' };
    });

    const encryptedToken = service.encryptToken('my-secret-token');
    await service.getRemoteTagsOutput('https://github.com/org/private.git', encryptedToken);

    expect(calls.length).toBe(1);
    expect(calls[0].cmd).toBe('git');
    expect(calls[0].args[0]).toBe('-c');
    expect(calls[0].args[1].startsWith('http.extraHeader=AUTHORIZATION: Bearer ')).toBe(true);
    expect(calls[0].args.slice(2)).toEqual(['ls-remote', '--tags', 'https://github.com/org/private.git']);
  });

  it('sanitizacao remove Authorization/basic e token', () => {
    const { service } = createService();
    const token = 'my-secret-token';
    const basic = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
    const input = `fatal: auth failed AUTHORIZATION: basic ${basic} token=${token}`;

    const out = service.sanitizeGitError(input, token);

    expect(out.includes(token)).toBe(false);
    expect(out.includes(basic)).toBe(false);
    expect(out.includes('AUTHORIZATION: basic [REDACTED]')).toBe(true);
  });

  it('formatVersion normaliza para vX.Y.Z', () => {
    const { service } = createService();

    expect(service.formatVersion('1.2.3')).toBe('v1.2.3');
    expect(service.formatVersion('v1.2.3')).toBe('v1.2.3');
  });

  it('prioriza tags da mesma linha major.minor da versao atual', async () => {
    const { service } = createService();

    jest.spyOn(service as unknown as { getRuntimeVersionInfo: () => { version: string } }, 'getRuntimeVersionInfo')
      .mockReturnValue({ version: 'v0.1.67' });

    service.execFileAsync = jest.fn(async () => ({
      stdout: [
        'hash\trefs/tags/v3.3.0',
        'hash\trefs/tags/v0.1.68',
        'hash\trefs/tags/v0.1.67',
      ].join('\n'),
      stderr: '',
    }));

    const result = await service.checkForUpdates();

    expect(result.availableVersion).toBe('v0.1.68');
    expect(result.updateAvailable).toBe(true);
  });

  it('executeUpdate inicia job assincrono e retorna operationId', async () => {
    const { service, prismaMock, systemUpdateAdminServiceMock, updateExecutionBridgeServiceMock } = createService();

    const result = await service.executeUpdate({ version: 'v1.2.3' }, 'user-1', '127.0.0.1', 'jest');

    expect(result).toEqual({
      success: true,
      logId: 'log-1',
      operationId: 'update-123',
      status: 'starting',
      message: 'Processo de atualizacao para v1.2.3 iniciado com sucesso.',
    });
    expect(systemUpdateAdminServiceMock.runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 'v1.2.3',
        userId: 'user-1',
      }),
    );
    expect(prismaMock.updateLog.create).toHaveBeenCalled();
    expect(prismaMock.updateLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-1' },
      }),
    );
    expect(updateExecutionBridgeServiceMock.launchLegacyExecution).not.toHaveBeenCalled();
  });

  it('executeUpdate usa bridge canonico quando UPDATE_ENGINE_V2_ENABLED=true', async () => {
    process.env.UPDATE_ENGINE_V2_ENABLED = 'true';
    const {
      service,
      systemUpdateAdminServiceMock,
      updateExecutionFacadeServiceMock,
      updateExecutionBridgeServiceMock,
      prismaMock,
    } = createService();

    updateExecutionBridgeServiceMock.isEnabled.mockReturnValue(true);

    const result = await service.executeUpdate({ version: 'v1.2.3' }, 'user-1', '127.0.0.1', 'jest');

    expect(result.operationId).toBe('bridge-123');
    expect(updateExecutionFacadeServiceMock.requestExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        targetVersion: 'v1.2.3',
        requestedBy: 'user-1',
        metadata: expect.objectContaining({
          gitRepoUrl: 'https://github.com/org/repo.git',
          composeFile: 'docker-compose.prod.yml',
          envFile: 'install/.env.production',
        }),
      }),
    );
    expect(updateExecutionBridgeServiceMock.launchLegacyExecution).toHaveBeenCalled();
    expect(systemUpdateAdminServiceMock.runUpdate).not.toHaveBeenCalled();
    expect(prismaMock.updateLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          executionLogs: expect.stringContaining('canonicalExecutionId'),
        }),
      }),
    );

    delete process.env.UPDATE_ENGINE_V2_ENABLED;
  });

  it('normalizeHttpStatus nao deixa exit code virar status HTTP', () => {
    const { service } = createService();

    expect(service.normalizeHttpStatus(50, 500)).toBe(500);
    expect(service.normalizeHttpStatus(500, 400)).toBe(500);
  });

  it('executeUpdate converte status invalido para 500 e preserva erro estruturado', async () => {
    const { service, prismaMock, systemUpdateAdminServiceMock } = createService();

    systemUpdateAdminServiceMock.runUpdate.mockRejectedValueOnce({
      message: 'healthcheck failed + rollback applied',
      status: 50,
      exitCode: 50,
    });

    try {
      await service.executeUpdate({ version: 'v1.2.3' }, 'user-1');
      throw new Error('expected executeUpdate to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(500);
      expect(httpError.getResponse()).toMatchObject({
        code: 'UPDATE_UNEXPECTED_ERROR',
        exitCode: 50,
      });
    }

    expect(prismaMock.updateLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
        }),
      }),
    );
  });

  it('getUpdateStatus combina status persistido com lifecycle executando', async () => {
    const { service, prismaMock, systemUpdateAdminServiceMock } = createService();

    prismaMock.updateSystemSettings.findFirst.mockResolvedValueOnce({
      id: 'settings-1',
      appVersion: 'v1.0.0',
      gitToken: null,
      gitUsername: 'org',
      gitRepository: 'repo',
      gitReleaseBranch: 'main',
      packageManager: 'docker',
      updateCheckEnabled: true,
      updateChannel: 'release',
      lastUpdateCheck: null,
      availableVersion: null,
      updateAvailable: false,
      releaseTag: 'latest',
      composeFile: 'docker-compose.prod.yml',
      envFile: 'install/.env.production',
      updatedAt: new Date(),
      updatedBy: null,
    });

    systemUpdateAdminServiceMock.getStatus.mockResolvedValueOnce({
      status: 'running',
      mode: 'native',
      startedAt: '2026-03-12T10:00:00.000Z',
      finishedAt: null,
      fromVersion: 'v1.0.0',
      toVersion: 'v1.2.3',
      step: 'healthcheck',
      progress: 82,
      lock: true,
      lastError: null,
      errorCode: null,
      errorCategory: null,
      errorStage: null,
      exitCode: null,
      userMessage: null,
      technicalMessage: null,
      rollback: {
        attempted: false,
        completed: false,
        reason: null,
      },
      operation: {
        active: true,
        operationId: 'update-123',
        type: 'update',
      },
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
        recoveredStepCode: 'healthcheck',
      },
    });

    const status = await service.getUpdateStatus();

    expect(status.mode).toBe('native');
    expect(status.configuredMode).toBe('docker');
    expect(status.effectiveMode).toBe('native');
    expect(status.modeSource).toBe('legacy_state');
    expect(status.updateLifecycle).toMatchObject({
      status: 'restarting_services',
      step: 'healthcheck',
      progress: 82,
      progressPercent: 82,
      progressKnown: true,
      currentStep: {
        code: 'post_deploy_validation',
      },
      operation: {
        active: true,
        operationId: 'update-123',
      },
    });
  });

  it('getUpdateStatus prioriza o modo operacional legado mesmo em idle quando a configuracao salva diverge', async () => {
    const { service, prismaMock, systemUpdateAdminServiceMock } = createService();

    prismaMock.updateSystemSettings.findFirst.mockResolvedValueOnce({
      id: 'settings-1',
      appVersion: 'v1.0.0',
      gitToken: null,
      gitUsername: 'org',
      gitRepository: 'repo',
      gitReleaseBranch: 'main',
      packageManager: 'docker',
      updateCheckEnabled: true,
      updateChannel: 'release',
      lastUpdateCheck: null,
      availableVersion: null,
      updateAvailable: false,
      releaseTag: 'latest',
      composeFile: 'docker-compose.prod.yml',
      envFile: 'install/.env.production',
      updatedAt: new Date(),
      updatedBy: null,
    });
    systemUpdateAdminServiceMock.getStatus.mockResolvedValueOnce({
      status: 'idle',
      mode: 'native',
      startedAt: null,
      finishedAt: null,
      fromVersion: 'v1.0.0',
      toVersion: 'unknown',
      step: 'idle',
      progress: 0,
      lock: false,
      lastError: null,
      errorCode: null,
      errorCategory: null,
      errorStage: null,
      exitCode: null,
      userMessage: null,
      technicalMessage: null,
      rollback: {
        attempted: false,
        completed: false,
        reason: null,
      },
      operation: {
        active: false,
        operationId: null,
        type: null,
      },
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
        recoveredStepCode: 'idle',
      },
    });
    service.detectHostInstallationMode = jest.fn(() => 'docker');

    const status = await service.getUpdateStatus();

    expect(status.mode).toBe('native');
    expect(status.configuredMode).toBe('docker');
    expect(status.effectiveMode).toBe('native');
    expect(status.detectedHostMode).toBe('docker');
    expect(status.modeSource).toBe('legacy_state');
  });

  it('getUpdateStatus nao promove docker apenas porque o host suporta container quando o status operacional nao esta disponivel', async () => {
    const { service, prismaMock, systemUpdateAdminServiceMock } = createService();

    prismaMock.updateSystemSettings.findFirst.mockResolvedValueOnce({
      id: 'settings-1',
      appVersion: 'v1.0.0',
      gitToken: null,
      gitUsername: 'org',
      gitRepository: 'repo',
      gitReleaseBranch: 'main',
      packageManager: 'native',
      updateCheckEnabled: true,
      updateChannel: 'release',
      lastUpdateCheck: null,
      availableVersion: null,
      updateAvailable: false,
      releaseTag: 'latest',
      composeFile: 'docker-compose.prod.yml',
      envFile: 'install/.env.production',
      updatedAt: new Date(),
      updatedBy: null,
    });
    systemUpdateAdminServiceMock.getStatus.mockRejectedValueOnce(new Error('falha de leitura do status operacional'));
    service.detectHostInstallationMode = jest.fn(() => 'docker');

    const status = await service.getUpdateStatus();

    expect(status.mode).toBe('native');
    expect(status.configuredMode).toBe('native');
    expect(status.effectiveMode).toBe('native');
    expect(status.detectedHostMode).toBe('docker');
    expect(status.modeSource).toBe('configured');
  });

  it('getUpdateStatus prioriza a execucao canonica quando ela diverge do fallback legado', async () => {
    const { service, prismaMock, systemUpdateAdminServiceMock, updateExecutionFacadeServiceMock } = createService();
    const previousReadFlag = process.env.UPDATE_ENGINE_V2_READ_ENABLED;

    process.env.UPDATE_ENGINE_V2_READ_ENABLED = 'true';
    prismaMock.updateSystemSettings.findFirst.mockResolvedValueOnce({
      id: 'settings-1',
      appVersion: 'v1.0.0',
      gitToken: null,
      gitUsername: 'org',
      gitRepository: 'repo',
      gitReleaseBranch: 'main',
      packageManager: 'native',
      updateCheckEnabled: true,
      updateChannel: 'release',
      lastUpdateCheck: null,
      availableVersion: null,
      updateAvailable: false,
      releaseTag: 'latest',
      composeFile: 'docker-compose.prod.yml',
      envFile: 'install/.env.production',
      updatedAt: new Date(),
      updatedBy: null,
    });
    systemUpdateAdminServiceMock.getStatus.mockResolvedValueOnce({
      status: 'running',
      mode: 'native',
      startedAt: '2026-03-12T10:00:00.000Z',
      finishedAt: null,
      fromVersion: 'v1.0.0',
      toVersion: 'v1.2.3',
      step: 'healthcheck',
      progress: 82,
      lock: true,
      lastError: null,
      errorCode: null,
      errorCategory: null,
      errorStage: null,
      exitCode: null,
      userMessage: null,
      technicalMessage: null,
      rollback: {
        attempted: false,
        completed: false,
        reason: null,
      },
      operation: {
        active: true,
        operationId: 'update-123',
        type: 'update',
      },
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
        recoveredStepCode: 'healthcheck',
      },
    });
    updateExecutionFacadeServiceMock.getCurrentExecutionView.mockResolvedValueOnce({
      id: 'execution-1',
      installationId: 'host-1',
      requestedBy: 'user-1',
      source: 'panel',
      mode: 'docker',
      currentVersion: 'v1.0.0',
      targetVersion: 'v1.2.3',
      status: 'running',
      currentStep: 'pull_images',
      failedStep: null,
      rollbackPolicy: 'code_only_safe',
      progressUnitsDone: 3,
      progressUnitsTotal: 14,
      error: null,
      metadata: {},
      requestedAt: '2026-03-12T00:00:00.000Z',
      startedAt: '2026-03-12T00:00:00.000Z',
      finishedAt: null,
      revision: 2,
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      progressPercent: 21,
      stepsPlanned: [],
    });

    try {
      const status = await service.getUpdateStatus();

      expect(status.mode).toBe('docker');
      expect(status.effectiveMode).toBe('docker');
      expect(status.configuredMode).toBe('native');
      expect(status.modeSource).toBe('canonical_execution');
      expect(status.updateLifecycle?.mode).toBe('docker');
    } finally {
      if (previousReadFlag === undefined) {
        delete process.env.UPDATE_ENGINE_V2_READ_ENABLED;
      } else {
        process.env.UPDATE_ENGINE_V2_READ_ENABLED = previousReadFlag;
      }
    }
  });

  it('getUpdateStatus preserva falha de persistencia com fallback coerente', async () => {
    const { service, systemUpdateAdminServiceMock } = createService();

    systemUpdateAdminServiceMock.getStatus.mockResolvedValueOnce({
      status: 'running',
      mode: 'docker',
      startedAt: '2026-03-12T10:00:00.000Z',
      finishedAt: null,
      fromVersion: 'v1.0.0',
      toVersion: 'v1.2.3',
      step: 'pull_images',
      progress: 0,
      lock: true,
      lastError: null,
      errorCode: null,
      errorCategory: null,
      errorStage: null,
      exitCode: null,
      userMessage: null,
      technicalMessage: null,
      rollback: {
        attempted: false,
        completed: false,
        reason: null,
      },
      operation: {
        active: true,
        operationId: 'update-999',
        type: 'update',
      },
      stale: false,
      statePath: '/tmp/update-state.json',
      logPath: '/tmp/update.log',
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
    });

    const status = await service.getUpdateStatus();

    expect(status.updateLifecycle).toMatchObject({
      status: 'running',
      progressPercent: null,
      progressKnown: false,
      currentStep: {
        code: 'pull_images',
      },
      persistenceError: {
        code: 'UPDATE_STATUS_PERSISTENCE_ERROR',
      },
    });
  });

  it('updateConfig persiste todos os campos expostos pela tela de updates', async () => {
    const { service, prismaMock } = createService();

    await service.updateConfig(
      {
        gitUsername: 'novo-org',
        gitRepository: 'novo-repo',
        gitReleaseBranch: 'stable',
        gitToken: '********',
        packageManager: 'docker',
        updateCheckEnabled: false,
        updateChannel: 'tag',
        releaseTag: 'v2.0.0',
        composeFile: 'docker-compose.custom.yml',
        envFile: 'install/.env.custom',
      },
      'user-1',
    );

    expect(prismaMock.updateSystemSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'settings-1' },
        data: expect.objectContaining({
          gitUsername: 'novo-org',
          gitRepository: 'novo-repo',
          gitReleaseBranch: 'stable',
          packageManager: 'docker',
          updateCheckEnabled: false,
          updateChannel: 'tag',
          releaseTag: 'v2.0.0',
          composeFile: 'docker-compose.custom.yml',
          envFile: 'install/.env.custom',
          updatedBy: 'user-1',
        }),
      }),
    );
  });

  it('updateConfig faz fallback para SQL bruto quando o Prisma encontra coluna ausente', async () => {
    const { service, prismaMock } = createService();
    const missingColumnError = new Prisma.PrismaClientKnownRequestError(
      'The column `update_system_settings.updateChannel` does not exist in the current database.',
      {
        code: 'P2022',
        clientVersion: '6.19.2',
      },
    );

    prismaMock.updateSystemSettings.update.mockRejectedValueOnce(missingColumnError);
    prismaMock.$queryRaw.mockResolvedValueOnce([
      { column_name: 'id' },
      { column_name: 'gitUsername' },
      { column_name: 'gitRepository' },
      { column_name: 'gitReleaseBranch' },
      { column_name: 'packageManager' },
      { column_name: 'updateCheckEnabled' },
      { column_name: 'updatedAt' },
      { column_name: 'updatedBy' },
    ]);

    await service.updateConfig(
      {
        gitUsername: 'legacy-org',
        gitRepository: 'legacy-repo',
        gitReleaseBranch: 'main',
        gitToken: '********',
        packageManager: 'docker',
        updateCheckEnabled: true,
        updateChannel: 'release',
        releaseTag: 'latest',
        composeFile: 'docker-compose.prod.yml',
        envFile: 'install/.env.production',
      },
      'user-legacy',
    );

    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });
});
