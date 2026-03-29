import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import { SystemVersionService } from '@common/services/system-version.service';
import { UpdateExecutionRepository } from './update-execution.repository';
import { UpdateStateMachineService } from './update-state-machine.service';
import {
  type UpdateExecutionMetadata,
  type UpdateExecutionMode,
  type UpdateExecutionSource,
  type UpdateRollbackPolicy,
  type UpdateExecutionStepView,
  type UpdateExecutionView,
} from './update-execution.types';

type RequestExecutionParams = {
  targetVersion: string;
  requestedBy: string | null;
  source: UpdateExecutionSource;
  mode?: UpdateExecutionMode;
  rollbackPolicy?: UpdateRollbackPolicy;
  metadata?: UpdateExecutionMetadata;
};

@Injectable()
export class UpdateExecutionFacadeService {
  constructor(
    private readonly repository: UpdateExecutionRepository,
    private readonly stateMachine: UpdateStateMachineService,
    private readonly systemVersionService: SystemVersionService,
  ) {}

  async requestExecution(params: RequestExecutionParams): Promise<UpdateExecutionView> {
    const installationId = this.resolveInstallationId();
    const currentExecution = await this.repository.findCurrentExecution(installationId);
    if (currentExecution) {
      throw new HttpException(
        {
          message: 'Ja existe uma execucao de update em andamento.',
          code: 'UPDATE_CONFLICT_ERROR',
          currentExecutionId: currentExecution.id,
        },
        HttpStatus.CONFLICT,
      );
    }

    const execution = this.stateMachine.createRequestedExecution({
      installationId,
      requestedBy: params.requestedBy,
      source: params.source,
      mode: params.mode || this.detectInstallationMode(),
      currentVersion: this.systemVersionService.getVersionInfo().version,
      targetVersion: this.normalizeVersion(params.targetVersion),
      rollbackPolicy: params.rollbackPolicy || 'code_only_safe',
      metadata: {
        ...params.metadata,
        requestedBy: params.requestedBy,
        source: params.source,
        installationId,
      },
    });

    const created = await this.repository.createExecution(execution);
    return this.stateMachine.buildExecutionView(created);
  }

  async getCurrentExecutionView(): Promise<UpdateExecutionView | null> {
    const execution = await this.repository.findCurrentExecution(this.resolveInstallationId());
    if (!execution) {
      return null;
    }

    return this.stateMachine.buildExecutionView(execution);
  }

  async getExecutionView(id: string): Promise<UpdateExecutionView> {
    const execution = await this.repository.findExecutionById(id);
    if (!execution) {
      throw new HttpException('Execucao de update nao encontrada.', HttpStatus.NOT_FOUND);
    }

    return this.stateMachine.buildExecutionView(execution);
  }

  async listExecutionSteps(id: string): Promise<UpdateExecutionStepView[]> {
    const execution = await this.repository.findExecutionById(id);
    if (!execution) {
      throw new HttpException('Execucao de update nao encontrada.', HttpStatus.NOT_FOUND);
    }

    const stepRuns = await this.repository.listStepRuns(id);
    return this.stateMachine.buildStepPlan(execution, stepRuns);
  }

  private normalizeVersion(version: string): string {
    const normalized = String(version || '').trim();
    if (!normalized) {
      throw new HttpException('Versao obrigatoria.', HttpStatus.BAD_REQUEST);
    }

    return normalized.startsWith('v') ? normalized : `v${normalized}`;
  }

  private resolveInstallationId(): string {
    const explicit = String(process.env.UPDATE_INSTALLATION_ID || '').trim();
    if (explicit) {
      return explicit;
    }

    const host = String(process.env.HOSTNAME || os.hostname() || '').trim();
    if (host) {
      return host;
    }

    return 'default-installation';
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
    } catch {
      // Empty implementation
    }

    return 'native';
  }
}
