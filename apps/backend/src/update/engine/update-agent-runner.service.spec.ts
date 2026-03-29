import { UpdateAgentRunnerService } from './update-agent-runner.service';

describe('UpdateAgentRunnerService', () => {
  const leaseServiceMock = {
    createRunnerIdentity: jest.fn(() => ({ runnerId: 'runner-1', leaseToken: 'lease-1' })),
    tryAcquire: jest.fn(async () => true),
    renew: jest.fn(async () => true),
    release: jest.fn(async () => undefined),
  };

  const repositoryMock = {
    findNextRequestedExecution: jest.fn(async () => null),
  };

  const bridgeServiceMock = {
    isEnabled: jest.fn(() => true),
    launchLegacyExecution: jest.fn(async () => ({ operationId: 'op-1' })),
  };

  const agentExecutionServiceMock = {
    processExecution: jest.fn(async (params: any) => ({
      kind: 'bridge',
      execution: {
        ...params.execution,
        progressPercent: 14,
        stepsPlanned: [],
      },
      bridgeEnv: {
        UPDATE_EXECUTION_ID: params.execution.id,
      },
    })),
  };

  const createService = () =>
    new UpdateAgentRunnerService(
      leaseServiceMock as any,
      repositoryMock as any,
      bridgeServiceMock as any,
      agentExecutionServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UPDATE_AGENT_ENABLED = 'true';
    process.env.UPDATE_AGENT_LEGACY_BRIDGE_ENABLED = 'true';
    process.env.UPDATE_INSTALLATION_ID = 'host-1';
  });

  afterEach(async () => {
    delete process.env.UPDATE_AGENT_ENABLED;
    delete process.env.UPDATE_AGENT_LEGACY_BRIDGE_ENABLED;
    delete process.env.UPDATE_INSTALLATION_ID;
  });

  it('nao inicia polling quando o agent esta desabilitado', async () => {
    delete process.env.UPDATE_AGENT_ENABLED;
    const service = createService();

    await service.onModuleInit();

    expect(leaseServiceMock.tryAcquire).not.toHaveBeenCalled();
  });

  it('consome execucao requested e aciona bridge legado quando habilitado', async () => {
    repositoryMock.findNextRequestedExecution.mockResolvedValueOnce({
      id: 'execution-1',
      requestedBy: 'super-1',
      targetVersion: 'v1.2.3',
      metadata: {
        userEmail: 'super@example.com',
        userRole: 'SUPER_ADMIN',
      },
      mode: 'docker',
    });

    const service = createService();
    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(leaseServiceMock.tryAcquire).toHaveBeenCalled();
    expect(leaseServiceMock.renew).toHaveBeenCalled();
    expect(repositoryMock.findNextRequestedExecution).toHaveBeenCalledWith('host-1');
    expect(agentExecutionServiceMock.processExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        runnerId: 'runner-1',
      }),
    );
    expect(bridgeServiceMock.launchLegacyExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        execution: expect.objectContaining({
          id: 'execution-1',
        }),
        version: 'v1.2.3',
        userId: 'super-1',
        skipCanonicalBootstrap: true,
      }),
    );
    expect(leaseServiceMock.release).toHaveBeenCalledWith('host-1', 'runner-1');
  });
});
