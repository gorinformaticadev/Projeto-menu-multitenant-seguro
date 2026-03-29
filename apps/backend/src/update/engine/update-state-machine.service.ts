import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  type CreateRequestedExecutionParams,
  type UpdateExecutionRecord,
  type UpdateExecutionView,
  type UpdateStepCode,
  type UpdateStepRunRecord,
  type UpdateExecutionStepView,
  getExecutionPlanForMode,
  getPrimaryExecutionStepsForMode,
} from './update-execution.types';

@Injectable()
export class UpdateStateMachineService {
  createRequestedExecution(params: CreateRequestedExecutionParams): UpdateExecutionRecord {
    const now = this.nowIso();
    const primarySteps = getPrimaryExecutionStepsForMode(params.mode);

    return {
      id: randomUUID(),
      installationId: params.installationId,
      requestedBy: params.requestedBy,
      source: params.source,
      mode: params.mode,
      currentVersion: params.currentVersion,
      targetVersion: params.targetVersion,
      status: 'requested',
      currentStep: primarySteps[0],
      failedStep: null,
      rollbackPolicy: params.rollbackPolicy,
      progressUnitsDone: 0,
      progressUnitsTotal: primarySteps.length,
      error: null,
      metadata: params.metadata || {},
      requestedAt: now,
      startedAt: null,
      finishedAt: null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  buildExecutionView(execution: UpdateExecutionRecord): UpdateExecutionView {
    return {
      ...execution,
      progressPercent: this.calculateProgressPercent(
        execution.progressUnitsDone,
        execution.progressUnitsTotal,
      ),
      stepsPlanned: getExecutionPlanForMode(execution.mode),
    };
  }

  buildStepPlan(
    execution: UpdateExecutionRecord,
    stepRuns: UpdateStepRunRecord[],
  ): UpdateExecutionStepView[] {
    const plannedSteps = getExecutionPlanForMode(execution.mode);
    const byStep = new Map(stepRuns.map((stepRun) => [stepRun.step, stepRun]));

    return plannedSteps.map((step, index) => {
      const stepRun = byStep.get(step);
      if (!stepRun) {
        return {
          step,
          ordinal: index + 1,
          status: 'pending',
          progressUnitsDone: 0,
          progressUnitsTotal: 0,
          startedAt: null,
          finishedAt: null,
          error: null,
          result: null,
        };
      }

      return {
        step,
        ordinal: stepRun.ordinal || index + 1,
        status: stepRun.status,
        progressUnitsDone: stepRun.progressUnitsDone,
        progressUnitsTotal: stepRun.progressUnitsTotal,
        startedAt: stepRun.startedAt,
        finishedAt: stepRun.finishedAt,
        error: stepRun.error,
        result: stepRun.result,
      };
    });
  }

  resolveOrdinal(mode: UpdateExecutionRecord['mode'], step: UpdateStepCode): number {
    const plan = getExecutionPlanForMode(mode);
    const index = plan.indexOf(step);
    return index >= 0 ? index + 1 : plan.length + 1;
  }

  calculateProgressPercent(done: number, total: number): number | null {
    if (!Number.isFinite(total) || total <= 0) {
      return null;
    }

    const normalizedDone = Number.isFinite(done) ? Math.max(0, Math.min(done, total)) : 0;
    return Math.floor((normalizedDone / total) * 100);
  }

  private nowIso(): string {
    return new Date().toISOString();
  }
}
