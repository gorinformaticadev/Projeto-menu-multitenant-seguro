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

export type UpdateStepExecutionEvidence = {
  code: string;
  summary: string;
  details?: Record<string, unknown>;
};

export type UpdateStepExecutionResult = {
  status?: 'completed' | 'skipped';
  result?: Record<string, unknown> | null;
  metadata?: UpdateExecutionMetadata;
  evidence?: UpdateStepExecutionEvidence[];
  retryable?: boolean;
};

export type UpdateRollbackExecutionResult = {
  result?: Record<string, unknown> | null;
  metadata?: UpdateExecutionMetadata;
  evidence?: UpdateStepExecutionEvidence[];
  retryable?: boolean;
};

type UpdateRuntimeStepErrorParams = {
  code: string;
  category: string;
  stage: UpdateStepCode;
  userMessage: string;
  technicalMessage?: string | null;
  exitCode?: number | null;
  retryable?: boolean;
  rollbackEligible?: boolean;
  commandRunId?: string | null;
  details?: Record<string, unknown>;
};

export class UpdateRuntimeStepError extends Error {
  readonly code: string;
  readonly category: string;
  readonly stage: UpdateStepCode;
  readonly userMessage: string;
  readonly technicalMessage: string | null;
  readonly exitCode: number | null;
  readonly retryable: boolean;
  readonly rollbackEligible: boolean;
  readonly commandRunId: string | null;
  readonly details: Record<string, unknown>;

  constructor(params: UpdateRuntimeStepErrorParams) {
    super(params.technicalMessage || params.userMessage);
    this.name = 'UpdateRuntimeStepError';
    this.code = params.code;
    this.category = params.category;
    this.stage = params.stage;
    this.userMessage = params.userMessage;
    this.technicalMessage = params.technicalMessage || null;
    this.exitCode = params.exitCode ?? null;
    this.retryable = params.retryable ?? false;
    this.rollbackEligible = params.rollbackEligible ?? true;
    this.commandRunId = params.commandRunId ?? null;
    this.details = params.details || {};
  }

  toSnapshot(): UpdateExecutionErrorSnapshot {
    return {
      code: this.code,
      category: this.category,
      stage: this.stage,
      userMessage: this.userMessage,
      technicalMessage: this.technicalMessage,
      exitCode: this.exitCode,
      retryable: this.retryable,
      rollbackEligible: this.rollbackEligible,
      commandRunId: this.commandRunId,
      details: this.details,
    };
  }
}

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
