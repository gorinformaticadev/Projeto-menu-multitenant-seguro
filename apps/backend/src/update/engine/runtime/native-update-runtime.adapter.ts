import { Injectable } from '@nestjs/common';
import { getExecutionPlanForMode } from '../update-execution.types';
import { type UpdateRuntimeAdapter, type UpdateRuntimeAdapterDescriptor } from './update-runtime-adapter.interface';

@Injectable()
export class NativeUpdateRuntimeAdapter implements UpdateRuntimeAdapter {
  readonly mode = 'native' as const;

  describe(): UpdateRuntimeAdapterDescriptor {
    return {
      mode: this.mode,
      executionStrategy: process.env.UPDATE_NATIVE_EXECUTION_STRATEGY === 'native_agent' ? 'native_agent' : 'legacy_bridge',
      supportsRollback: true,
      restartStrategy: 'pm2_reload_or_start',
      healthcheckStrategy: 'http_and_runtime_probes',
      plannedSteps: getExecutionPlanForMode(this.mode),
    };
  }
}
