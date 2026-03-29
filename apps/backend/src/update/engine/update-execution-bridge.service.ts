import { Injectable, Logger } from '@nestjs/common';
import { UpdateExecutionRepository } from './update-execution.repository';
import { UpdateStateMachineService } from './update-state-machine.service';
import { SystemUpdateAdminService } from '../system-update-admin.service';
import {
  type UpdateExecutionErrorSnapshot,
  type UpdateExecutionRecord,
  type UpdateExecutionStepView,
  type UpdateExecutionView,
  type UpdateStepCode,
  getExecutionPlanForMode,
  getPrimaryExecutionStepsForMode,
} from './update-execution.types';

type BridgeLaunchParams = {
  execution: UpdateExecutionView;
  version: string;
  userId: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  env?: NodeJS.ProcessEnv;
  skipCanonicalBootstrap?: boolean;
};

type LegacySystemStateSnapshot = {
  status: 'idle' | 'running' | 'success' | 'failed' | 'rolled_back';
  mode: 'docker' | 'native';
  startedAt: string | null;
  finishedAt: string | null;
  step: string;
  progress: number;
  lock: boolean;
  lastError: string | null;
  errorCode: string | null;
  errorCategory: string | null;
  errorStage: string | null;
  exitCode: number | null;
  userMessage: string | null;
  technicalMessage: string | null;
  rollback: {
    attempted: boolean;
    completed: boolean;
    reason: string | null;
  };
  operation: {
    active: boolean;
    operationId: string | null;
    type: 'update' | 'rollback' | null;
  };
};

@Injectable()
export class UpdateExecutionBridgeService {
  private readonly logger = new Logger(UpdateExecutionBridgeService.name);

  constructor(
    private readonly repository: UpdateExecutionRepository,
    private readonly stateMachine: UpdateStateMachineService,
    private readonly systemUpdateAdminService: SystemUpdateAdminService,
  ) {}

  isEnabled(): boolean {
    return process.env.UPDATE_ENGINE_V2_ENABLED === 'true';
  }

  async launchLegacyExecution(params: BridgeLaunchParams): Promise<{
    operationId: string;
    execution: UpdateExecutionView;
  }> {
    const executionRecord = params.skipCanonicalBootstrap
      ? (await this.repository.findExecutionById(params.execution.id)) || params.execution
      : await this.repository.updateExecution(params.execution.id, {
          status: 'running',
          currentStep: 'precheck',
          progressUnitsDone: 0,
          progressUnitsTotal: getPrimaryExecutionStepsForMode(params.execution.mode).length,
          startedAt: new Date().toISOString(),
          metadata: {
            bridgeMode: 'legacy_system_update_admin',
            bridgeStatus: 'launching',
          },
        });

    if (!params.skipCanonicalBootstrap) {
      await this.repository.upsertProjectedSteps(
        executionRecord.id,
        this.stateMachine.buildStepPlan(executionRecord, []),
      );
    }

    try {
      const launchResult = await this.systemUpdateAdminService.runUpdate({
        version: params.version,
        userId: params.userId,
        userEmail: params.userEmail,
        userRole: params.userRole,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        env: params.env,
      });

      const attached = await this.repository.updateExecution(executionRecord.id, {
        metadata: {
          bridgeMode: 'legacy_system_update_admin',
          bridgeStatus: 'running',
          legacyOperationId: launchResult.operationId,
        },
      });

      return {
        operationId: launchResult.operationId,
        execution: this.stateMachine.buildExecutionView(attached),
      };
    } catch (error) {
      const failed = await this.repository.updateExecution(executionRecord.id, {
        status: 'failed',
        failedStep: 'precheck',
        currentStep: 'precheck',
        progressUnitsDone: 0,
        error: this.buildBridgeError(error, 'precheck'),
        finishedAt: new Date().toISOString(),
        metadata: {
          bridgeMode: 'legacy_system_update_admin',
          bridgeStatus: 'launch_failed',
        },
      });

      await this.repository.upsertProjectedSteps(
        failed.id,
        this.buildProjectedSteps(failed, null),
      );
      throw error;
    }
  }

  async syncCurrentLegacyBridgeExecution(
    execution: UpdateExecutionView | null,
  ): Promise<UpdateExecutionView | null> {
    if (!execution) {
      return null;
    }

    const bridgeMode = String(execution.metadata?.bridgeMode || '').trim();
    if (bridgeMode !== 'legacy_system_update_admin') {
      return execution;
    }

    if (
      execution.status !== 'requested' &&
      execution.status !== 'running' &&
      execution.status !== 'rollback'
    ) {
      return execution;
    }

    try {
      const legacyState = (await this.systemUpdateAdminService.getStatus()) as LegacySystemStateSnapshot;
      const synced = await this.applyLegacyState(execution, legacyState);
      return this.stateMachine.buildExecutionView(synced);
    } catch (error) {
      this.logger.warn(`Falha ao sincronizar execucao canonica com legado: ${String(error)}`);
      return execution;
    }
  }

  private async applyLegacyState(
    execution: UpdateExecutionView,
    legacyState: LegacySystemStateSnapshot,
  ): Promise<UpdateExecutionRecord> {
    const mappedStep = this.mapLegacyStepToCanonicalStep(legacyState.step, execution.mode);
    const primarySteps = getPrimaryExecutionStepsForMode(execution.mode);
    const currentIndex = Math.max(0, primarySteps.indexOf(mappedStep));
    const progressUnitsDone =
      legacyState.status === 'success' || legacyState.status === 'rolled_back'
        ? primarySteps.length
        : currentIndex;

    const patch: Parameters<UpdateExecutionRepository['updateExecution']>[1] = {
      status:
        legacyState.status === 'success'
          ? 'completed'
          : legacyState.status === 'failed'
            ? 'failed'
            : legacyState.status === 'rolled_back'
              ? 'rollback'
              : 'running',
      currentStep: mappedStep,
      failedStep:
        legacyState.status === 'failed' || legacyState.status === 'rolled_back'
          ? this.mapLegacyStepToCanonicalStep(legacyState.errorStage || legacyState.step, execution.mode)
          : null,
      progressUnitsDone,
      progressUnitsTotal: primarySteps.length,
      startedAt: legacyState.startedAt || execution.startedAt || new Date().toISOString(),
      finishedAt:
        legacyState.status === 'success' || legacyState.status === 'failed' || legacyState.status === 'rolled_back'
          ? legacyState.finishedAt || new Date().toISOString()
          : null,
      error:
        legacyState.status === 'failed' || legacyState.status === 'rolled_back'
          ? {
              code: legacyState.errorCode || 'UPDATE_UNEXPECTED_ERROR',
              category: legacyState.errorCategory || 'UPDATE_UNEXPECTED_ERROR',
              stage: this.mapLegacyStepToCanonicalStep(legacyState.errorStage || legacyState.step, execution.mode),
              userMessage: legacyState.userMessage || 'Falha durante atualizacao.',
              technicalMessage: legacyState.technicalMessage || legacyState.lastError || null,
              exitCode: legacyState.exitCode,
              retryable: false,
              rollbackEligible: legacyState.status !== 'rolled_back',
              commandRunId: null,
              details: {
                legacyStep: legacyState.step,
                legacyStatus: legacyState.status,
              },
            }
          : null,
      metadata: {
        bridgeMode: 'legacy_system_update_admin',
        bridgeStatus: legacyState.status,
        legacyOperationId: legacyState.operation?.operationId || null,
      },
    };

    const updated = await this.repository.updateExecution(execution.id, patch);
    await this.repository.upsertProjectedSteps(
      updated.id,
      this.buildProjectedSteps(updated, patch.error || null),
    );
    return updated;
  }

  private buildProjectedSteps(
    execution: UpdateExecutionRecord,
    error: UpdateExecutionErrorSnapshot | null,
  ): UpdateExecutionStepView[] {
    const plan = getExecutionPlanForMode(execution.mode);
    const primaryPlan = getPrimaryExecutionStepsForMode(execution.mode);
    const currentIndex = Math.max(0, primaryPlan.indexOf(execution.currentStep));

    return plan.map((step, index) => {
      let status: UpdateExecutionStepView['status'] = 'pending';

      if (step === 'rollback') {
        if (execution.status === 'rollback' && execution.finishedAt) {
          status = 'completed';
        } else if (execution.status === 'rollback') {
          status = 'running';
        } else if (execution.status === 'completed') {
          status = 'skipped';
        }
      } else if (execution.status === 'completed') {
        status = 'completed';
      } else if (execution.status === 'rollback') {
        if (index < currentIndex) {
          status = 'completed';
        } else if (step === execution.currentStep) {
          status = 'failed';
        }
      } else if (execution.status === 'failed') {
        if (index < currentIndex) {
          status = 'completed';
        } else if (step === execution.currentStep) {
          status = 'failed';
        }
      } else if (execution.status === 'running') {
        if (index < currentIndex) {
          status = 'completed';
        } else if (step === execution.currentStep) {
          status = 'running';
        }
      }

      return {
        step,
        ordinal: index + 1,
        status,
        progressUnitsDone: status === 'completed' ? 1 : 0,
        progressUnitsTotal: 1,
        startedAt:
          status === 'completed' || status === 'running' || status === 'failed'
            ? execution.startedAt
            : null,
        finishedAt:
          status === 'completed' && execution.finishedAt
            ? execution.finishedAt
            : status === 'failed'
              ? execution.finishedAt
              : null,
        error: status === 'failed' || step === 'rollback' ? error : null,
        result:
          status === 'completed'
            ? {
                source: 'legacy_bridge',
              }
            : null,
      };
    });
  }

  private mapLegacyStepToCanonicalStep(step: string | null | undefined, mode: UpdateExecutionRecord['mode']): UpdateStepCode {
    const normalized = String(step || '').trim().toLowerCase();

    if (normalized === 'pull_images') return 'pull_images';
    if (normalized === 'download') return mode === 'docker' ? 'pull_images' : 'fetch_code';
    if (normalized === 'prepare' || normalized === 'starting') return 'prepare';
    if (normalized === 'precheck') return 'precheck';
    if (normalized === 'install_dependencies') return 'install_dependencies';
    if (normalized === 'build_prisma_client' || normalized === 'build_backend') return 'build_backend';
    if (normalized === 'build_frontend') return 'build_frontend';
    if (
      normalized === 'package_frontend_assets' ||
      normalized === 'validate_frontend_artifact' ||
      normalized === 'pre_swap_smoke_test'
    ) {
      return 'pre_switch_validation';
    }
    if (normalized === 'migrate') return 'migrate';
    if (normalized === 'seed') return 'seed';
    if (
      normalized === 'enable_maintenance' ||
      normalized === 'publish_release' ||
      normalized === 'switch_release'
    ) {
      return 'switch_release';
    }
    if (
      normalized === 'restart_pm2' ||
      normalized === 'recreate_containers' ||
      normalized === 'restart_services'
    ) {
      return 'restart_services';
    }
    if (
      normalized === 'validate_backend_storage' ||
      normalized === 'healthcheck_frontend' ||
      normalized === 'healthcheck_backend'
    ) {
      return 'healthcheck';
    }
    if (normalized === 'post_deploy_validation' || normalized === 'validate') return 'post_validation';
    if (normalized === 'cleanup_old_releases' || normalized === 'completed') return 'cleanup';
    if (normalized === 'rollback') return 'rollback';

    return mode === 'docker' ? 'pull_images' : 'fetch_code';
  }

  private buildBridgeError(error: unknown, stage: UpdateStepCode): UpdateExecutionErrorSnapshot {
    const technicalMessage = error instanceof Error ? error.message : String(error);

    return {
      code: 'UPDATE_BRIDGE_LAUNCH_ERROR',
      category: 'UPDATE_UNEXPECTED_ERROR',
      stage,
      userMessage: 'Falha ao iniciar a execucao canonica via bridge legado.',
      technicalMessage,
      exitCode: null,
      retryable: false,
      rollbackEligible: false,
      commandRunId: null,
      details: {},
    };
  }
}
