import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { UpdateAgentExecutionService } from './update-agent-execution.service';
import type { UpdateExecutionRecord } from './update-execution.types';

function createExecution(overrides: Partial<UpdateExecutionRecord> = {}): UpdateExecutionRecord {
  return {
    id: 'execution-1',
    installationId: 'host-1',
    requestedBy: 'super-1',
    source: 'panel',
    mode: 'native',
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
    requestedAt: '2026-03-29T00:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    revision: 1,
    createdAt: '2026-03-29T00:00:00.000Z',
    updatedAt: '2026-03-29T00:00:00.000Z',
    ...overrides,
  };
}

describe('UpdateAgentExecutionService', () => {
  let tmpDir: string;
  let currentExecution: UpdateExecutionRecord;
  let adapterDescriptor: {
    mode: 'native' | 'docker';
    executionStrategy: 'legacy_bridge' | 'native_agent';
    supportsRollback: boolean;
    restartStrategy: string;
    healthcheckStrategy: string;
    plannedSteps: string[];
  };

  const adapterMock = {
    executeStep: jest.fn(async (step: string) => ({
      result: {
        step,
      },
    })),
    executeRollback: jest.fn(async () => ({
      result: {
        rolledBack: true,
      },
      metadata: {
        rollbackCompleted: true,
      },
    })),
  };

  const repositoryMock = {
    updateExecution: jest.fn(async (_id: string, patch: Record<string, unknown>) => {
      currentExecution = {
        ...currentExecution,
        ...(patch as Partial<UpdateExecutionRecord>),
        metadata: {
          ...currentExecution.metadata,
          ...((patch.metadata as Record<string, unknown> | undefined) || {}),
        },
      };

      return currentExecution;
    }),
    findExecutionById: jest.fn(async () => currentExecution),
    upsertProjectedSteps: jest.fn(async () => undefined),
    replaceEnvSnapshots: jest.fn(async () => undefined),
    replaceReleaseSnapshots: jest.fn(async () => undefined),
  };

  const stateMachineMock = {
    resolveOrdinal: jest.fn((mode: string, step: string) => {
      const plan =
        mode === 'docker'
          ? ['precheck', 'prepare', 'pull_images', 'rollback']
          : ['precheck', 'prepare', 'fetch_code', 'rollback'];
      return plan.indexOf(step) + 1;
    }),
    buildExecutionView: jest.fn((execution: UpdateExecutionRecord) => ({
      ...execution,
      progressPercent: 14,
      stepsPlanned: ['precheck', 'prepare', 'fetch_code', 'rollback'],
    })),
  };

  const registryMock = {
    get: jest.fn(() => adapterDescriptor),
    resolve: jest.fn(() => adapterMock),
  };

  const pathsServiceMock = {
    getProjectRoot: jest.fn(() => tmpDir),
  };

  const createService = () =>
    new UpdateAgentExecutionService(
      repositoryMock as any,
      stateMachineMock as any,
      registryMock as any,
      pathsServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    adapterMock.executeStep.mockImplementation(async (step: string) => ({
      result: {
        step,
      },
    }));
    adapterMock.executeRollback.mockImplementation(async () => ({
      result: {
        rolledBack: true,
      },
      metadata: {
        rollbackCompleted: true,
      },
    }));
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluggor-update-agent-'));
    currentExecution = createExecution();
    adapterDescriptor = {
      mode: 'native',
      executionStrategy: 'legacy_bridge',
      supportsRollback: true,
      restartStrategy: 'pm2_reload_or_start',
      healthcheckStrategy: 'http_and_runtime_probes',
      plannedSteps: ['precheck', 'prepare', 'fetch_code'],
    };
    process.env.APP_BASE_DIR = tmpDir;

    fs.mkdirSync(path.join(tmpDir, 'install'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'apps', 'backend'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'install', 'update-native.sh'), '#!/usr/bin/env bash\n');
    fs.writeFileSync(path.join(tmpDir, 'install', 'update-images.sh'), '#!/usr/bin/env bash\n');
    fs.writeFileSync(path.join(tmpDir, 'apps', 'backend', '.env'), 'DATABASE_URL=postgres://secret\nJWT_SECRET=test\n');
  });

  afterEach(() => {
    delete process.env.APP_BASE_DIR;
    delete process.env.IS_DOCKER;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('executa precheck e prepare antes de entregar a execucao ao bridge legado', async () => {
    const service = createService();

    const result = await service.bootstrapExecution({
      execution: currentExecution,
      runnerId: 'runner-1',
      allowLegacyBridge: true,
    });

    expect(result).not.toBeNull();
    expect(repositoryMock.upsertProjectedSteps).toHaveBeenCalledTimes(4);
    expect(repositoryMock.replaceEnvSnapshots).toHaveBeenCalledWith(
      'execution-1',
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'backend',
        }),
      ]),
    );
    expect(repositoryMock.replaceReleaseSnapshots).toHaveBeenCalledWith(
      'execution-1',
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'target_release',
          version: 'v1.2.3',
        }),
      ]),
    );
    expect(result).toMatchObject({
      bridgeEnv: {
        UPDATE_EXECUTION_ID: 'execution-1',
      },
      execution: {
        id: 'execution-1',
        currentStep: 'fetch_code',
        status: 'running',
      },
    });
  });

  it('falha de forma estruturada quando o bridge legado nao esta autorizado', async () => {
    const service = createService();

    const result = await service.bootstrapExecution({
      execution: currentExecution,
      runnerId: 'runner-1',
      allowLegacyBridge: false,
    });

    expect(result).toBeNull();
    expect(repositoryMock.replaceEnvSnapshots).not.toHaveBeenCalled();
    expect(repositoryMock.updateExecution).toHaveBeenCalledWith(
      'execution-1',
      expect.objectContaining({
        status: 'failed',
        failedStep: 'precheck',
        error: expect.objectContaining({
          code: 'UPDATE_LEGACY_BRIDGE_DISABLED',
        }),
      }),
    );
  });

  it('executa o pipeline native_agent completo ate cleanup', async () => {
    adapterDescriptor = {
      ...adapterDescriptor,
      executionStrategy: 'native_agent',
      plannedSteps: [
        'precheck',
        'prepare',
        'fetch_code',
        'install_dependencies',
        'build_backend',
        'build_frontend',
        'migrate',
        'seed',
        'pre_switch_validation',
        'switch_release',
        'restart_services',
        'healthcheck',
        'post_validation',
        'cleanup',
      ],
    };
    const service = createService();

    const result = await service.processExecution({
      execution: currentExecution,
      runnerId: 'runner-1',
      allowLegacyBridge: false,
    });

    expect(result.kind).toBe('handled');
    expect(adapterMock.executeStep).toHaveBeenCalledWith(
      'fetch_code',
      expect.objectContaining({
        execution: expect.objectContaining({
          id: 'execution-1',
        }),
      }),
    );
    expect(adapterMock.executeStep).toHaveBeenCalledWith('cleanup', expect.anything());
    expect(adapterMock.executeRollback).not.toHaveBeenCalled();
    expect(result.execution).toMatchObject({
      status: 'completed',
      currentStep: 'cleanup',
    });
  });

  it('executa rollback automatico quando uma etapa falha e a politica permite', async () => {
    adapterDescriptor = {
      ...adapterDescriptor,
      executionStrategy: 'native_agent',
    };
    adapterMock.executeStep.mockImplementation(async (step: string) => {
      if (step === 'healthcheck') {
        throw new Error('healthcheck failed');
      }

      return {
        result: {
          step,
        },
      };
    });

    currentExecution = createExecution({
      rollbackPolicy: 'code_only_safe',
    });
    const service = createService();

    const result = await service.processExecution({
      execution: currentExecution,
      runnerId: 'runner-1',
      allowLegacyBridge: false,
    });

    expect(result.kind).toBe('handled');
    expect(adapterMock.executeRollback).toHaveBeenCalled();
    expect(result.execution.status).toBe('rollback');
  });

  it('executa o pipeline docker completo com native_agent', async () => {
    process.env.IS_DOCKER = 'true';
    currentExecution = createExecution({
      mode: 'docker',
      currentStep: 'precheck',
    });
    adapterDescriptor = {
      mode: 'docker',
      executionStrategy: 'native_agent',
      supportsRollback: true,
      restartStrategy: 'docker_compose_recreate',
      healthcheckStrategy: 'container_and_http_probes',
      plannedSteps: [
        'precheck',
        'prepare',
        'pull_images',
        'install_dependencies',
        'build_backend',
        'build_frontend',
        'migrate',
        'seed',
        'pre_switch_validation',
        'switch_release',
        'restart_services',
        'healthcheck',
        'post_validation',
        'cleanup',
      ],
    };

    const service = createService();
    const result = await service.processExecution({
      execution: currentExecution,
      runnerId: 'runner-1',
      allowLegacyBridge: false,
    });

    expect(result.kind).toBe('handled');
    expect(adapterMock.executeStep).toHaveBeenCalledWith('pull_images', expect.anything());
    expect(result.execution).toMatchObject({
      status: 'completed',
      currentStep: 'cleanup',
    });
  });
});
