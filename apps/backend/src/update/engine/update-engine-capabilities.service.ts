import { Injectable } from '@nestjs/common';
import { UpdateRuntimeAdapterRegistryService } from './runtime/update-runtime-adapter-registry.service';

@Injectable()
export class UpdateEngineCapabilitiesService {
  constructor(private readonly registry: UpdateRuntimeAdapterRegistryService) {}

  getCapabilities() {
    return {
      sourceOfTruth: 'canonical_db',
      updateAgent: {
        enabled: process.env.UPDATE_AGENT_ENABLED === 'true',
        legacyBridgeEnabled: process.env.UPDATE_AGENT_LEGACY_BRIDGE_ENABLED === 'true',
      },
      canonicalReadEnabled:
        process.env.UPDATE_ENGINE_V2_ENABLED === 'true' ||
        process.env.UPDATE_ENGINE_V2_READ_ENABLED === 'true',
      runtimeAdapters: this.registry.list(),
    };
  }
}
