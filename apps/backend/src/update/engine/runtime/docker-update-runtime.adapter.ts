import { Injectable } from '@nestjs/common';
import { getExecutionPlanForMode } from '../update-execution.types';
import { type UpdateRuntimeAdapter, type UpdateRuntimeAdapterDescriptor } from './update-runtime-adapter.interface';

@Injectable()
export class DockerUpdateRuntimeAdapter implements UpdateRuntimeAdapter {
  readonly mode = 'docker' as const;

  describe(): UpdateRuntimeAdapterDescriptor {
    return {
      mode: this.mode,
      executionStrategy: process.env.UPDATE_DOCKER_EXECUTION_STRATEGY === 'native_agent' ? 'native_agent' : 'legacy_bridge',
      supportsRollback: true,
      restartStrategy: 'docker_compose_recreate',
      healthcheckStrategy: 'container_and_http_probes',
      plannedSteps: getExecutionPlanForMode(this.mode),
    };
  }
}
