import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { PathsService } from '@core/common/paths/paths.service';
import { UpdateExecutionRepository } from './update-execution.repository';
import { UpdateStateMachineService } from './update-state-machine.service';
import { UpdateRuntimeAdapterRegistryService } from './runtime/update-runtime-adapter-registry.service';
import {
  type UpdateEnvSnapshotInput,
  type UpdateExecutionErrorSnapshot,
  type UpdateExecutionMetadata,
  type UpdateExecutionRecord,
  type UpdateExecutionView,
  type UpdateExecutionMode,
  type UpdateReleaseSnapshotInput,
  type UpdateStepCode,
  getPrimaryExecutionStepsForMode,
} from './update-execution.types';
import type { UpdateRuntimePaths } from './runtime/update-runtime-adapter.interface';

type ProcessExecutionParams = {
  execution: UpdateExecutionRecord;
  runnerId: string;
  allowLegacyBridge: boolean;
};

type ProcessExecutionResult =
  | {
      kind: 'bridge';
      execution: UpdateExecutionView;
      bridgeEnv: NodeJS.ProcessEnv;
    }
  | {
      kind: 'handled';
      execution: UpdateExecutionView;
    };

type BootstrapExecutionResult = {
  execution: UpdateExecutionView;
  bridgeEnv: NodeJS.ProcessEnv;
};

@Injectable()
export class UpdateAgentExecutionService {
  private readonly logger = new Logger(UpdateAgentExecutionService.name);

  constructor(
    private readonly repository: UpdateExecutionRepository,
    private readonly stateMachine: UpdateStateMachineService,
    private readonly registry: UpdateRuntimeAdapterRegistryService,
    private readonly pathsService: PathsService,
  ) {}

  async processExecution(params: ProcessExecutionParams): Promise<ProcessExecutionResult> {
    const descriptor = this.registry.get(params.execution.mode);
    if (descriptor.executionStrategy === 'legacy_bridge') {
      if (!params.allowLegacyBridge) {
        const error = this.buildExecutionError(
          'UPDATE_LEGACY_BRIDGE_DISABLED',
          'UPDATE_LEGACY_BRIDGE_DISABLED',
          'precheck',
          'O update-agent nao esta autorizado a acionar o executor legado para esta instalacao.',
          'UPDATE_AGENT_LEGACY_BRIDGE_ENABLED=false',
          {
            mode: params.execution.mode,
            executionStrategy: descriptor.executionStrategy,
          },
          false,
        );
        await this.failExecution(params.execution, 'precheck', error);
        return {
          kind: 'handled',
          execution: this.stateMachine.buildExecutionView(
            (await this.repository.findExecutionById(params.execution.id)) || params.execution,
          ),
        };
      }
    }

    const adapter = this.registry.resolve(params.execution.mode);
    const runtime = await this.resolveRuntimeContext(params.execution.mode, params.execution.id);

    let execution = await this.markExecutionRunning(params.execution, params.runnerId, descriptor, runtime);
    execution = await this.runPrecheckStep(execution, params.runnerId, runtime);
    execution = await this.runPrepareStep(execution, params.runnerId, runtime);

    if (descriptor.executionStrategy === 'legacy_bridge') {
      return {
        kind: 'bridge',
        execution: this.stateMachine.buildExecutionView(execution),
        bridgeEnv: {
          UPDATE_EXECUTION_ID: execution.id,
          UPDATE_EXECUTION_MODE: execution.mode,
          UPDATE_EXECUTION_RUNNER_ID: params.runnerId,
        },
      };
    }

    execution = await this.runPrimaryPipeline(execution, runtime);
    return {
      kind: 'handled',
      execution: this.stateMachine.buildExecutionView(execution),
    };
  }

  async bootstrapExecution(params: ProcessExecutionParams): Promise<BootstrapExecutionResult | null> {
    const processed = await this.processExecution(params);
    if (processed.kind !== 'bridge') {
      return null;
    }

    return {
      execution: processed.execution,
      bridgeEnv: processed.bridgeEnv,
    };
  }

  private async runPrimaryPipeline(
    execution: UpdateExecutionRecord,
    runtime: UpdateRuntimePaths,
  ): Promise<UpdateExecutionRecord> {
    const adapter = this.registry.resolve(execution.mode);
    const steps = getPrimaryExecutionStepsForMode(execution.mode).slice(2);

    for (const step of steps) {
      const startedAt = new Date().toISOString();
      const currentMetadata = execution.metadata || {};

      await this.persistStep(execution, step, 'running', startedAt, null, null, {
        runnerStep: step,
      });
      execution = await this.repository.updateExecution(execution.id, {
        currentStep: step,
        metadata: {
          activeStep: step,
        },
      });

      try {
        const result = await adapter.executeStep(step, {
          execution,
          runtime,
          metadata: currentMetadata,
        });

        const finishedAt = new Date().toISOString();
        const nextStep = this.resolveNextStep(execution.mode, step);
        const normalizedStatus = result.status || 'completed';
        const progressIncrement = 1;

        await this.persistStep(
          execution,
          step,
          normalizedStatus === 'skipped' ? 'skipped' : 'completed',
          startedAt,
          finishedAt,
          null,
          result.result || null,
        );

        execution = await this.repository.updateExecution(execution.id, {
          currentStep: nextStep || step,
          progressUnitsDone: execution.progressUnitsDone + progressIncrement,
          progressUnitsTotal: getPrimaryExecutionStepsForMode(execution.mode).length,
          metadata: result.metadata || {},
          finishedAt: step === 'cleanup' ? finishedAt : undefined,
          status: step === 'cleanup' ? 'completed' : undefined,
        });
      } catch (error) {
        const structuredError = this.buildStepFailure(step, error);
        const rollbackEligible = this.canAutoRollback(execution, step);

        if (rollbackEligible) {
          const rolledBack = await this.attemptRollback(execution, runtime, structuredError);
          if (rolledBack) {
            const latest = (await this.repository.findExecutionById(execution.id)) || execution;
            return latest;
          }
        }

        await this.failExecution(execution, step, structuredError, startedAt);
        const latest = (await this.repository.findExecutionById(execution.id)) || execution;
        return latest;
      }
    }

    const latest = (await this.repository.findExecutionById(execution.id)) || execution;
    return latest;
  }

  private async attemptRollback(
    execution: UpdateExecutionRecord,
    runtime: UpdateRuntimePaths,
    error: UpdateExecutionErrorSnapshot,
  ): Promise<boolean> {
    const adapter = this.registry.resolve(execution.mode);
    const startedAt = new Date().toISOString();
    await this.persistStep(execution, 'rollback', 'running', startedAt, null, null, {
      triggeredBy: error.stage,
    });

    await this.repository.updateExecution(execution.id, {
      status: 'rollback',
      currentStep: 'rollback',
      failedStep: error.stage as UpdateStepCode,
      error,
      metadata: {
        rollbackRequestedBy: error.stage,
      },
    });

    try {
      const result = await adapter.executeRollback(
        {
          execution,
          runtime,
          metadata: execution.metadata || {},
        },
        error,
      );
      const finishedAt = new Date().toISOString();

      await this.persistStep(
        execution,
        'rollback',
        'completed',
        startedAt,
        finishedAt,
        null,
        result.result || null,
      );
      await this.repository.updateExecution(execution.id, {
        status: 'rollback',
        currentStep: 'rollback',
        finishedAt,
        metadata: {
          rollbackCompleted: true,
          rollbackCompletedAt: finishedAt,
          ...(result.metadata || {}),
        },
      });
      return true;
    } catch (rollbackError) {
      const rollbackStructuredError = this.buildExecutionError(
        'UPDATE_ROLLBACK_FAILED',
        'UPDATE_ROLLBACK_FAILED',
        'rollback',
        'O rollback automatico falhou apos erro no deploy.',
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        {
          originalErrorCode: error.code,
          originalStage: error.stage,
        },
        false,
      );

      await this.persistStep(
        execution,
        'rollback',
        'failed',
        startedAt,
        new Date().toISOString(),
        rollbackStructuredError,
        null,
      );
      await this.repository.updateExecution(execution.id, {
        status: 'failed',
        currentStep: 'rollback',
        failedStep: 'rollback',
        finishedAt: new Date().toISOString(),
        error: rollbackStructuredError,
        metadata: {
          rollbackCompleted: false,
        },
      });
      return false;
    }
  }

  private canAutoRollback(execution: UpdateExecutionRecord, failedStep: UpdateStepCode): boolean {
    if (execution.rollbackPolicy === 'manual_only') {
      return false;
    }

    if (execution.rollbackPolicy === 'restore_required') {
      const guardedSteps: UpdateStepCode[] = [
        'migrate',
        'seed',
        'switch_release',
        'restart_services',
        'healthcheck',
        'post_validation',
        'cleanup',
      ];
      if (guardedSteps.includes(failedStep)) {
        return false;
      }
    }

    return true;
  }

  private buildStepFailure(step: UpdateStepCode, error: unknown): UpdateExecutionErrorSnapshot {
    const technicalMessage = error instanceof Error ? error.message : String(error);
    const codeByStep: Record<UpdateStepCode, string> = {
      precheck: 'UPDATE_PRECHECK_FAILED',
      prepare: 'UPDATE_PREPARE_FAILED',
      fetch_code: 'UPDATE_FETCH_CODE_FAILED',
      pull_images: 'UPDATE_PULL_IMAGES_FAILED',
      install_dependencies: 'UPDATE_INSTALL_FAILED',
      build_backend: 'UPDATE_BUILD_BACKEND_FAILED',
      build_frontend: 'UPDATE_BUILD_FRONTEND_FAILED',
      migrate: 'UPDATE_MIGRATE_FAILED',
      seed: 'UPDATE_SEED_FAILED',
      pre_switch_validation: 'UPDATE_PRE_SWITCH_VALIDATION_FAILED',
      switch_release: 'UPDATE_SWITCH_RELEASE_FAILED',
      restart_services: 'UPDATE_RESTART_FAILED',
      healthcheck: 'UPDATE_HEALTHCHECK_FAILED',
      post_validation: 'UPDATE_POST_VALIDATION_FAILED',
      cleanup: 'UPDATE_CLEANUP_FAILED',
      rollback: 'UPDATE_ROLLBACK_FAILED',
    };

    return this.buildExecutionError(
      codeByStep[step],
      codeByStep[step],
      step,
      `Falha durante a etapa ${step} do update.`,
      technicalMessage,
      {
        step,
      },
      true,
    );
  }

  private resolveNextStep(mode: UpdateExecutionMode, currentStep: UpdateStepCode): UpdateStepCode | null {
    const steps = getPrimaryExecutionStepsForMode(mode);
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < 0 || currentIndex + 1 >= steps.length) {
      return null;
    }

    return steps[currentIndex + 1];
  }

  private async markExecutionRunning(
    execution: UpdateExecutionRecord,
    runnerId: string,
    descriptor: ReturnType<UpdateRuntimeAdapterRegistryService['get']>,
    runtime: UpdateRuntimePaths,
  ): Promise<UpdateExecutionRecord> {
    return await this.repository.updateExecution(execution.id, {
      status: 'running',
      currentStep: 'precheck',
      progressUnitsDone: 0,
      progressUnitsTotal: getPrimaryExecutionStepsForMode(execution.mode).length,
      startedAt: execution.startedAt || new Date().toISOString(),
      metadata: {
        runnerId,
        runtimeMode: runtime.mode,
        detectedMode: runtime.detectedMode,
        baseDir: runtime.baseDir,
        sharedDir: runtime.sharedDir,
        releasesDir: runtime.releasesDir,
        logsDir: runtime.logsDir,
        updateScriptPath: runtime.updateScriptPath,
        rollbackScriptPath: runtime.rollbackScriptPath,
        executionStrategy: descriptor.executionStrategy,
        restartStrategy: descriptor.restartStrategy,
        healthcheckStrategy: descriptor.healthcheckStrategy,
        bootstrapSource: 'update_agent',
      },
    });
  }

  private async runPrecheckStep(
    execution: UpdateExecutionRecord,
    runnerId: string,
    runtime: UpdateRuntimePaths,
  ): Promise<UpdateExecutionRecord> {
    const step: UpdateStepCode = 'precheck';
    const startedAt = new Date().toISOString();
    await this.persistStep(
      execution,
      step,
      'running',
      startedAt,
      null,
      null,
      {
        runnerId,
      },
    );

    try {
      const checks = await this.performPrecheck(execution, runtime);
      const finishedAt = new Date().toISOString();

      await this.persistStep(execution, step, 'completed', startedAt, finishedAt, null, checks);

      return await this.repository.updateExecution(execution.id, {
        currentStep: 'prepare',
        progressUnitsDone: 1,
        progressUnitsTotal: getPrimaryExecutionStepsForMode(execution.mode).length,
        metadata: {
          precheckSummary: checks,
        },
      });
    } catch (error) {
      const structuredError = this.buildExecutionError(
        'UPDATE_PRECHECK_FAILED',
        'UPDATE_PRECHECK_FAILED',
        step,
        'A validacao inicial do ambiente falhou antes de alterar o runtime.',
        error instanceof Error ? error.message : String(error),
        {
          mode: execution.mode,
          baseDir: runtime.baseDir,
        },
        false,
      );

      await this.failExecution(execution, step, structuredError, startedAt);
      throw error;
    }
  }

  private async runPrepareStep(
    execution: UpdateExecutionRecord,
    runnerId: string,
    runtime: UpdateRuntimePaths,
  ): Promise<UpdateExecutionRecord> {
    const step: UpdateStepCode = 'prepare';
    const startedAt = new Date().toISOString();
    await this.persistStep(
      execution,
      step,
      'running',
      startedAt,
      null,
      null,
      {
        runnerId,
      },
    );

    try {
      await this.ensureDir(runtime.sharedDir);
      await this.ensureDir(runtime.releasesDir);
      await this.ensureDir(runtime.logsDir);

      const envSnapshots = await this.captureEnvSnapshots(runtime);
      const releaseSnapshots = await this.captureReleaseSnapshots(execution, runtime);

      await this.repository.replaceEnvSnapshots(execution.id, envSnapshots);
      await this.repository.replaceReleaseSnapshots(execution.id, releaseSnapshots);

      const finishedAt = new Date().toISOString();
      const nextStep = execution.mode === 'docker' ? 'pull_images' : 'fetch_code';
      const prepareResult = {
        envSnapshotsCaptured: envSnapshots.length,
        releaseSnapshotsCaptured: releaseSnapshots.length,
        nextStep,
      };

      await this.persistStep(execution, step, 'completed', startedAt, finishedAt, null, prepareResult);

      return await this.repository.updateExecution(execution.id, {
        currentStep: nextStep,
        progressUnitsDone: 2,
        progressUnitsTotal: getPrimaryExecutionStepsForMode(execution.mode).length,
        metadata: {
          prepareSummary: prepareResult,
          currentReleaseRef: releaseSnapshots.find((snapshot) =>
            snapshot.kind === 'current_release' || snapshot.kind === 'current_images',
          )?.ref || null,
          previousReleaseRef: releaseSnapshots.find((snapshot) =>
            snapshot.kind === 'previous_release' || snapshot.kind === 'previous_images',
          )?.ref || null,
          targetReleaseRef:
            releaseSnapshots.find((snapshot) => snapshot.kind === 'target_release')?.ref || null,
        },
      });
    } catch (error) {
      const structuredError = this.buildExecutionError(
        'UPDATE_PREPARE_FAILED',
        'UPDATE_PREPARE_FAILED',
        step,
        'Falha ao preparar snapshots e contexto operacional da execucao.',
        error instanceof Error ? error.message : String(error),
        {
          mode: execution.mode,
          baseDir: runtime.baseDir,
        },
        false,
      );

      await this.failExecution(execution, step, structuredError, startedAt);
      throw error;
    }
  }

  private async performPrecheck(
    execution: UpdateExecutionRecord,
    runtime: UpdateRuntimePaths,
  ): Promise<Record<string, unknown>> {
    if (runtime.detectedMode !== execution.mode) {
      throw new Error(
        `Modo da execucao difere do host atual (execution=${execution.mode}, detected=${runtime.detectedMode}).`,
      );
    }

    if (!fs.existsSync(runtime.updateScriptPath)) {
      throw new Error(`Script de update nao encontrado em ${runtime.updateScriptPath}.`);
    }

    const currentDirExists = await this.pathExists(runtime.currentDir);
    const sourceTreeExists = await this.pathExists(path.join(runtime.baseDir, 'apps', 'backend'));
    const releasesDirExists = await this.pathExists(runtime.releasesDir);

    if (!currentDirExists && !sourceTreeExists && execution.mode === 'native') {
      throw new Error(`Nenhuma release ativa ou arvore de aplicacao foi encontrada em ${runtime.baseDir}.`);
    }

    await this.assertReadable(runtime.baseDir);

    return {
      detectedMode: runtime.detectedMode,
      baseDir: runtime.baseDir,
      currentDirExists,
      sourceTreeExists,
      releasesDirExists,
      updateScriptPath: runtime.updateScriptPath,
    };
  }

  private async captureEnvSnapshots(runtime: UpdateRuntimePaths): Promise<UpdateEnvSnapshotInput[]> {
    const candidates: Array<{
      scope: UpdateEnvSnapshotInput['scope'];
      schemaVersion: string;
      candidates: string[];
    }> = [
      {
        scope: 'backend',
        schemaVersion: 'legacy-env-file-v1',
        candidates: [
          path.join(runtime.baseDir, 'shared', 'config', 'backend.env'),
          path.join(runtime.baseDir, 'shared', '.env'),
          path.join(runtime.baseDir, 'current', 'apps', 'backend', '.env'),
          path.join(runtime.baseDir, 'apps', 'backend', '.env'),
        ],
      },
      {
        scope: 'frontend_runtime',
        schemaVersion: 'legacy-runtime-file-v1',
        candidates: [
          path.join(runtime.baseDir, 'shared', 'config', 'frontend-runtime.json'),
          path.join(runtime.baseDir, 'shared', '.env.frontend.local'),
          path.join(runtime.baseDir, 'current', 'apps', 'frontend', '.env.production'),
          path.join(runtime.baseDir, 'apps', 'frontend', '.env.production'),
        ],
      },
      {
        scope: 'release_runtime',
        schemaVersion: 'runtime-manifest-v1',
        candidates: [path.join(runtime.baseDir, 'current', 'release-manifest.json')],
      },
    ];

    if (runtime.mode === 'docker') {
      candidates.push({
        scope: 'docker',
        schemaVersion: 'legacy-env-file-v1',
        candidates: [
          path.join(runtime.baseDir, 'shared', 'config', 'docker.env'),
          path.join(runtime.baseDir, 'install', '.env.production'),
        ],
      });
    }

    const snapshots: UpdateEnvSnapshotInput[] = [];
    for (const candidate of candidates) {
      const selectedPath = await this.pickExistingPath(candidate.candidates);
      if (!selectedPath) {
        continue;
      }

      const rawContent = await fsp.readFile(selectedPath, 'utf8');
      snapshots.push({
        scope: candidate.scope,
        schemaVersion: candidate.schemaVersion,
        checksum: this.checksum(rawContent),
        contentEncrypted: JSON.stringify({
          format: 'redacted_v1',
          sourcePath: selectedPath,
          capturedAt: new Date().toISOString(),
          redactedContent: this.redactConfigContent(rawContent),
        }),
      });
    }

    return snapshots;
  }

  private async captureReleaseSnapshots(
    execution: UpdateExecutionRecord,
    runtime: UpdateRuntimePaths,
  ): Promise<UpdateReleaseSnapshotInput[]> {
    const snapshots: UpdateReleaseSnapshotInput[] = [];
    const currentRef = await this.safeRealpath(runtime.currentDir);
    if (currentRef) {
      snapshots.push({
        kind: execution.mode === 'docker' ? 'current_images' : 'current_release',
        ref: currentRef,
        version: execution.currentVersion,
        digest: null,
        metadata: {
          sourcePath: runtime.currentDir,
        },
      });
    }

    const previousRef = await this.safeRealpath(runtime.previousDir);
    if (previousRef) {
      snapshots.push({
        kind: execution.mode === 'docker' ? 'previous_images' : 'previous_release',
        ref: previousRef,
        version: null,
        digest: null,
        metadata: {
          sourcePath: runtime.previousDir,
        },
      });
    }

    snapshots.push({
      kind: 'target_release',
      ref:
        execution.mode === 'docker'
          ? `image_tag:${execution.targetVersion}`
          : path.join(runtime.releasesDir, execution.targetVersion),
      version: execution.targetVersion,
      digest: null,
      metadata: {
        mode: execution.mode,
      },
    });

    return snapshots;
  }

  private async failExecution(
    execution: UpdateExecutionRecord,
    step: UpdateStepCode,
    error: UpdateExecutionErrorSnapshot,
    startedAt?: string,
  ): Promise<void> {
    const finishedAt = new Date().toISOString();
    await this.persistStep(
      execution,
      step,
      'failed',
      startedAt || execution.startedAt || finishedAt,
      finishedAt,
      error,
      null,
    );

    await this.repository.updateExecution(execution.id, {
      status: 'failed',
      currentStep: step,
      failedStep: step,
      finishedAt,
      error,
      metadata: {
        failedBy: 'update_agent',
      },
    });
  }

  private async persistStep(
    execution: UpdateExecutionRecord,
    step: UpdateStepCode,
    status: 'running' | 'completed' | 'failed' | 'skipped',
    startedAt: string,
    finishedAt: string | null,
    error: UpdateExecutionErrorSnapshot | null,
    result: Record<string, unknown> | null,
  ): Promise<void> {
    await this.repository.upsertProjectedSteps(execution.id, [
      {
        step,
        ordinal: this.stateMachine.resolveOrdinal(execution.mode, step),
        status,
        progressUnitsDone: status === 'completed' ? 1 : 0,
        progressUnitsTotal: 1,
        startedAt,
        finishedAt,
        error,
        result,
      },
    ]);
  }

  private buildExecutionError(
    code: string,
    category: string,
    stage: UpdateStepCode,
    userMessage: string,
    technicalMessage: string | null,
    details: Record<string, unknown>,
    rollbackEligible: boolean,
  ): UpdateExecutionErrorSnapshot {
    return {
      code,
      category,
      stage,
      userMessage,
      technicalMessage,
      exitCode: null,
      retryable: false,
      rollbackEligible,
      commandRunId: null,
      details,
    };
  }

  private async resolveRuntimeContext(
    mode: UpdateExecutionMode,
    executionId: string,
  ): Promise<UpdateRuntimePaths> {
    const baseDir = this.resolveBaseDir();
    const sharedDir = path.join(baseDir, 'shared');
    const releasesDir = path.join(baseDir, 'releases');
    const currentDir = path.join(baseDir, 'current');
    const previousDir = path.join(baseDir, 'previous');
    const logsDir = path.join(sharedDir, 'logs', 'update-engine', executionId);
    const updateScriptCandidates =
      mode === 'docker'
        ? [
            path.join(this.pathsService.getProjectRoot(), 'install', 'update-images.sh'),
            path.join(baseDir, 'current', 'install', 'update-images.sh'),
            path.join(baseDir, 'install', 'update-images.sh'),
          ]
        : [
            path.join(this.pathsService.getProjectRoot(), 'install', 'update-native.sh'),
            path.join(baseDir, 'current', 'install', 'update-native.sh'),
            path.join(baseDir, 'install', 'update-native.sh'),
          ];
    const rollbackScriptCandidates = [
      path.join(this.pathsService.getProjectRoot(), 'install', 'rollback-native.sh'),
      path.join(baseDir, 'current', 'install', 'rollback-native.sh'),
      path.join(baseDir, 'install', 'rollback-native.sh'),
    ];

    return {
      baseDir,
      sharedDir,
      releasesDir,
      currentDir,
      previousDir,
      logsDir,
      updateScriptPath: this.pickFirstCandidate(updateScriptCandidates),
      rollbackScriptPath: this.pickFirstCandidate(rollbackScriptCandidates),
      mode,
      detectedMode: this.detectInstallationMode(),
    };
  }

  private detectInstallationMode(): UpdateExecutionMode {
    try {
      if (process.env.IS_DOCKER === 'true') {
        return 'docker';
      }

      if (fs.existsSync('/.dockerenv')) {
        return 'docker';
      }

      const cgroupPath = '/proc/1/cgroup';
      if (fs.existsSync(cgroupPath)) {
        const cgroup = fs.readFileSync(cgroupPath, 'utf8');
        if (/docker|containerd|kubepods/i.test(cgroup)) {
          return 'docker';
        }
      }
    } catch (error) {
      this.logger.warn(`Falha ao detectar modo de instalacao no update-agent: ${String(error)}`);
    }

    return 'native';
  }

  private resolveBaseDir(): string {
    const fromEnv = String(process.env.APP_BASE_DIR || '').trim();
    if (fromEnv) {
      return path.resolve(fromEnv);
    }

    const projectRoot = path.resolve(this.pathsService.getProjectRoot());
    if (path.basename(projectRoot) === 'current') {
      return path.resolve(projectRoot, '..');
    }

    if (path.basename(path.dirname(projectRoot)) === 'releases') {
      return path.resolve(projectRoot, '..', '..');
    }

    return projectRoot;
  }

  private pickFirstCandidate(candidates: string[]): string {
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }

  private async pickExistingPath(candidates: string[]): Promise<string | null> {
    for (const candidate of candidates) {
      if (await this.pathExists(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private async assertReadable(targetPath: string): Promise<void> {
    await fsp.access(targetPath, fs.constants.R_OK);
  }

  private async ensureDir(targetPath: string): Promise<void> {
    await fsp.mkdir(targetPath, { recursive: true });
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fsp.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async safeRealpath(targetPath: string): Promise<string | null> {
    try {
      return await fsp.realpath(targetPath);
    } catch {
      return null;
    }
  }

  private checksum(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }

  private redactConfigContent(content: string): string {
    return content
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          return line;
        }

        const separatorIndex = line.indexOf('=');
        if (separatorIndex < 0) {
          return '[REDACTED]';
        }

        return `${line.slice(0, separatorIndex + 1)}[REDACTED]`;
      })
      .join('\n');
  }
}
