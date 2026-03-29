import type { UpdateExecutionMode, UpdateStepCode } from '../update-execution.types';

export type UpdateRuntimeExecutionStrategy = 'legacy_bridge' | 'native_agent';

export type UpdateRuntimeAdapterDescriptor = {
  mode: UpdateExecutionMode;
  executionStrategy: UpdateRuntimeExecutionStrategy;
  supportsRollback: boolean;
  restartStrategy: string;
  healthcheckStrategy: string;
  plannedSteps: UpdateStepCode[];
};

export interface UpdateRuntimeAdapter {
  readonly mode: UpdateExecutionMode;
  describe(): UpdateRuntimeAdapterDescriptor;
}
