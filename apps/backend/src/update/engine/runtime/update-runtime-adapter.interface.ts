import type {
  UpdateExecutionErrorSnapshot,
  UpdateExecutionMetadata,
  UpdateExecutionMode,
  UpdateExecutionRecord,
  UpdateStepCode,
} from '../update-execution.types';

export type UpdateRuntimeExecutionStrategy = 'legacy_bridge' | 'native_agent';

export type UpdateRuntimeAdapterDescriptor = {
  mode: UpdateExecutionMode;
  executionStrategy: UpdateRuntimeExecutionStrategy;
  supportsRollback: boolean;
  restartStrategy: string;
  healthcheckStrategy: string;
  plannedSteps: UpdateStepCode[];
};

export type UpdateRuntimePaths = {
  baseDir: string;
  sharedDir: string;
  releasesDir: string;
  currentDir: string;
  previousDir: string;
  logsDir: string;
  updateScriptPath: string;
  rollbackScriptPath: string;
  mode: UpdateExecutionMode;
  detectedMode: UpdateExecutionMode;
};

export type UpdateStepExecutionContext = {
  execution: UpdateExecutionRecord;
  runtime: UpdateRuntimePaths;
  metadata: UpdateExecutionMetadata;
};

export type UpdateStepExecutionResult = {
  status?: 'completed' | 'skipped';
  result?: Record<string, unknown> | null;
  metadata?: UpdateExecutionMetadata;
};

export type UpdateRollbackExecutionResult = {
  result?: Record<string, unknown> | null;
  metadata?: UpdateExecutionMetadata;
};

export interface UpdateRuntimeAdapter {
  readonly mode: UpdateExecutionMode;
  describe(): UpdateRuntimeAdapterDescriptor;
  executeStep(
    step: UpdateStepCode,
    context: UpdateStepExecutionContext,
  ): Promise<UpdateStepExecutionResult>;
  executeRollback(
    context: UpdateStepExecutionContext,
    error: UpdateExecutionErrorSnapshot,
  ): Promise<UpdateRollbackExecutionResult>;
}
