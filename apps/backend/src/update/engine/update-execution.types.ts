export type UpdateExecutionStatus = 'requested' | 'running' | 'completed' | 'failed' | 'rollback';

export type UpdateExecutionMode = 'native' | 'docker';

export type UpdateExecutionSource = 'panel' | 'terminal' | 'system';

export type UpdateRollbackPolicy = 'code_only_safe' | 'restore_required' | 'manual_only';

export type UpdateEnvSnapshotScope =
  | 'backend'
  | 'frontend_runtime'
  | 'docker'
  | 'release_runtime';

export type UpdateReleaseSnapshotKind =
  | 'current_release'
  | 'previous_release'
  | 'target_release'
  | 'current_images'
  | 'previous_images';

export type UpdateStepRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type UpdateStepCode =
  | 'precheck'
  | 'prepare'
  | 'fetch_code'
  | 'pull_images'
  | 'install_dependencies'
  | 'build_backend'
  | 'build_frontend'
  | 'migrate'
  | 'seed'
  | 'pre_switch_validation'
  | 'switch_release'
  | 'restart_services'
  | 'healthcheck'
  | 'post_validation'
  | 'cleanup'
  | 'rollback';

export type UpdateExecutionErrorSnapshot = {
  code: string;
  category: string;
  stage: string;
  userMessage: string;
  technicalMessage: string | null;
  exitCode: number | null;
  retryable: boolean;
  rollbackEligible: boolean;
  commandRunId: string | null;
  details: Record<string, unknown>;
};

export type UpdateExecutionMetadata = Record<string, unknown>;

export type UpdateEnvSnapshotInput = {
  scope: UpdateEnvSnapshotScope;
  schemaVersion: string;
  checksum: string;
  contentEncrypted: string;
};

export type UpdateReleaseSnapshotInput = {
  kind: UpdateReleaseSnapshotKind;
  ref: string;
  version: string | null;
  digest: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type UpdateCommandRunInput = {
  id?: string;
  executionId: string;
  stepRunId?: string | null;
  command: string;
  args: string[];
  cwd?: string | null;
  stdoutPath?: string | null;
  stderrPath?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateExecutionRecord = {
  id: string;
  installationId: string;
  requestedBy: string | null;
  source: UpdateExecutionSource;
  mode: UpdateExecutionMode;
  currentVersion: string;
  targetVersion: string;
  status: UpdateExecutionStatus;
  currentStep: UpdateStepCode;
  failedStep: UpdateStepCode | null;
  rollbackPolicy: UpdateRollbackPolicy;
  progressUnitsDone: number;
  progressUnitsTotal: number;
  error: UpdateExecutionErrorSnapshot | null;
  metadata: UpdateExecutionMetadata;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type UpdateStepRunRecord = {
  id: string;
  executionId: string;
  step: UpdateStepCode;
  ordinal: number;
  attempt: number;
  status: UpdateStepRunStatus;
  progressUnitsDone: number;
  progressUnitsTotal: number;
  result: Record<string, unknown> | null;
  error: UpdateExecutionErrorSnapshot | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type UpdateExecutionView = UpdateExecutionRecord & {
  progressPercent: number | null;
  stepsPlanned: UpdateStepCode[];
};

export type UpdateExecutionStepView = {
  step: UpdateStepCode;
  ordinal: number;
  status: UpdateStepRunStatus;
  progressUnitsDone: number;
  progressUnitsTotal: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: UpdateExecutionErrorSnapshot | null;
  result: Record<string, unknown> | null;
};

export type CreateRequestedExecutionParams = {
  installationId: string;
  requestedBy: string | null;
  source: UpdateExecutionSource;
  mode: UpdateExecutionMode;
  currentVersion: string;
  targetVersion: string;
  rollbackPolicy: UpdateRollbackPolicy;
  metadata?: UpdateExecutionMetadata;
};

export const NATIVE_PRIMARY_STEPS: UpdateStepCode[] = [
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
];

export const DOCKER_PRIMARY_STEPS: UpdateStepCode[] = [
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
];

export function getPrimaryExecutionStepsForMode(mode: UpdateExecutionMode): UpdateStepCode[] {
  return mode === 'docker' ? [...DOCKER_PRIMARY_STEPS] : [...NATIVE_PRIMARY_STEPS];
}

export function getExecutionPlanForMode(mode: UpdateExecutionMode): UpdateStepCode[] {
  return [...getPrimaryExecutionStepsForMode(mode), 'rollback'];
}
