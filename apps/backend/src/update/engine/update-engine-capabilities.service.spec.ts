import { UpdateEngineCapabilitiesService } from './update-engine-capabilities.service';

describe('UpdateEngineCapabilitiesService', () => {
  afterEach(() => {
    delete process.env.UPDATE_AGENT_ENABLED;
    delete process.env.UPDATE_AGENT_LEGACY_BRIDGE_ENABLED;
    delete process.env.UPDATE_ENGINE_V2_ENABLED;
    delete process.env.UPDATE_ENGINE_V2_READ_ENABLED;
  });

  it('expõe os adapters registrados e as flags operacionais do engine', () => {
    process.env.UPDATE_AGENT_ENABLED = 'true';
    process.env.UPDATE_AGENT_LEGACY_BRIDGE_ENABLED = 'true';
    process.env.UPDATE_ENGINE_V2_READ_ENABLED = 'true';

    const registryMock = {
      list: jest.fn(() => [
        {
          mode: 'native',
          executionStrategy: 'legacy_bridge',
          supportsRollback: true,
          restartStrategy: 'pm2_reload_or_start',
          healthcheckStrategy: 'http_and_runtime_probes',
          plannedSteps: ['precheck', 'prepare'],
        },
      ]),
    };

    const service = new UpdateEngineCapabilitiesService(registryMock as any);
    const capabilities = service.getCapabilities();

    expect(capabilities).toMatchObject({
      sourceOfTruth: 'canonical_db',
      updateAgent: {
        enabled: true,
        legacyBridgeEnabled: true,
      },
      canonicalReadEnabled: true,
      runtimeAdapters: [
        expect.objectContaining({
          mode: 'native',
        }),
      ],
    });
  });
});
