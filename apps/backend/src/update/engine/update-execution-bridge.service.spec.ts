import { UpdateExecutionBridgeService } from './update-execution-bridge.service';
import type { UpdateExecutionRecord, UpdateExecutionView } from './update-execution.types';

function createExecution(): UpdateExecutionView {
  const record: UpdateExecutionRecord = {
    id: 'execution-1',
    installationId: 'host-1',
    requestedBy: 'super-1',
    source: 'panel',
    mode: 'native',
    currentVersion: 'v1.0.0',
    targetVersion: 'v1.2.3',
    status: 'running',
    currentStep: 'fetch_code',
    failedStep: null,
    rollbackPolicy: 'code_only_safe',
    progressUnitsDone: 2,
    progressUnitsTotal: 14,
    error: null,
    metadata: {
      executionStrategy: 'legacy_bridge',
    },
    requestedAt: '2026-03-29T00:00:00.000Z',
    startedAt: '2026-03-29T00:00:01.000Z',
    finishedAt: null,
    revision: 1,
    createdAt: '2026-03-29T00:00:00.000Z',
    updatedAt: '2026-03-29T00:00:01.000Z',
  };

  return {
    ...record,
    progressPercent: 14,
    stepsPlanned: ['precheck', 'prepare', 'fetch_code', 'rollback'],
  };
}

describe('UpdateExecutionBridgeService', () => {
  const execution = createExecution();
  let currentExecution: UpdateExecutionRecord;

  const repositoryMock = {
    findExecutionById: jest.fn(async () => currentExecution),
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
    upsertProjectedSteps: jest.fn(async () => undefined),
  };

  const stateMachineMock = {
    buildExecutionView: jest.fn((input: UpdateExecutionRecord) => ({
      ...input,
      progressPercent: 14,
      stepsPlanned: ['precheck', 'prepare', 'fetch_code', 'rollback'],
    })),
    buildStepPlan: jest.fn(() => []),
  };

  const systemUpdateAdminServiceMock = {
    runUpdate: jest.fn(async () => ({
      operationId: 'legacy-op-1',
    })),
    getStatus: jest.fn(async () => null),
  };

  const createService = () =>
    new UpdateExecutionBridgeService(
      repositoryMock as any,
      stateMachineMock as any,
      systemUpdateAdminServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    currentExecution = {
      ...execution,
    };
  });

  it('nao redefine bootstrap canônico quando recebe execucao já preparada', async () => {
    const service = createService();

    const result = await service.launchLegacyExecution({
      execution,
      version: 'v1.2.3',
      userId: 'super-1',
      skipCanonicalBootstrap: true,
    });

    expect(repositoryMock.findExecutionById).toHaveBeenCalledWith('execution-1');
    expect(repositoryMock.upsertProjectedSteps).not.toHaveBeenCalled();
    expect(repositoryMock.updateExecution).toHaveBeenCalledTimes(1);
    expect(repositoryMock.updateExecution).toHaveBeenCalledWith(
      'execution-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          bridgeMode: 'legacy_system_update_admin',
          bridgeStatus: 'running',
          legacyOperationId: 'legacy-op-1',
        }),
      }),
    );
    expect(result.execution.currentStep).toBe('fetch_code');
    expect(result.execution.status).toBe('running');
  });
});
