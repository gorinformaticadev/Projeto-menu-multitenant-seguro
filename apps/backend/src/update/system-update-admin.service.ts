import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notification.service';
import { PathsService } from '@core/common/paths/paths.service';

type UpdateStateStatus = 'idle' | 'running' | 'success' | 'failed' | 'rolled_back';
type UpdateMode = 'docker' | 'native';

type UpdateState = {
  status: UpdateStateStatus;
  mode: UpdateMode;
  startedAt: string | null;
  finishedAt: string | null;
  fromVersion: string;
  toVersion: string;
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
};

type UpdateOperationType = 'update' | 'rollback';

type RunOperationRequest = {
  version?: string;
  target?: string;
  legacyInplace?: boolean;
  userId: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
};

type RuntimePaths = {
  baseDir: string;
  sharedDir: string;
  releasesDir: string;
  statePath: string;
  logPath: string;
  lockPath: string;
  updateScriptPath: string;
  rollbackScriptPath: string;
  mode: UpdateMode;
};

type UpdateFailureDescriptor = {
  code: string;
  category: string;
  stage: string;
  userMessage: string;
};

const DEFAULT_UPDATE_STATE: UpdateState = {
  status: 'idle',
  mode: 'native',
  startedAt: null,
  finishedAt: null,
  fromVersion: 'unknown',
  toVersion: 'unknown',
  step: 'idle',
  progress: 0,
  lock: false,
  lastError: null,
  errorCode: null,
  errorCategory: null,
  errorStage: null,
  exitCode: null,
  userMessage: null,
  technicalMessage: null,
  rollback: {
    attempted: false,
    completed: false,
    reason: null,
  },
};

@Injectable()
export class SystemUpdateAdminService {
  private readonly logger = new Logger(SystemUpdateAdminService.name);
  private activeProcess: ChildProcessWithoutNullStreams | null = null;
  private activeOperationId: string | null = null;
  private activeOperationType: UpdateOperationType | null = null;

  constructor(
    private readonly pathsService: PathsService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async runUpdate(request: RunOperationRequest): Promise<{
    success: boolean;
    operationId: string;
    message: string;
  }> {
    const version = String(request.version || '').trim();
    if (!version) {
      throw new HttpException('Versao obrigatoria para iniciar update', HttpStatus.BAD_REQUEST);
    }

    const mode = this.detectInstallationMode();
    const runtime = this.resolveRuntimePaths(mode);
    this.ensureScriptExists(runtime.updateScriptPath, mode === 'docker' ? 'update-images.sh' : 'update-native.sh');
    await this.assertNoRunningOperation(runtime, true);
    const fromVersion = await this.resolveCurrentVersion(runtime.baseDir);

    if (request.legacyInplace && mode !== 'native') {
      throw new HttpException(
        'Modo --legacy-inplace disponivel apenas para instalacao nativa.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (request.legacyInplace && mode === 'native') {
      const allowLegacyApi = process.env.UPDATE_ALLOW_LEGACY_INPLACE_API === 'true';
      if (!allowLegacyApi) {
        throw new HttpException(
          'Modo --legacy-inplace nao permitido via API. Habilite UPDATE_ALLOW_LEGACY_INPLACE_API=true para liberar.',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const args = [runtime.updateScriptPath];
    if (mode === 'native') {
      args.push('--tag', version);
    }
    if (request.legacyInplace && mode === 'native') {
      args.push('--legacy-inplace');
    }

    await this.writeUpdateRunningState(runtime, fromVersion, version);
    await this.appendLog(runtime.logPath, 'update', `Update solicitado para versao ${version} (mode=${mode}).`);

    const operationId = this.createOperationId('update');
    const child = this.spawnOperation('update', operationId, 'bash', args, runtime, {
      TARGET_TAG: version,
      RELEASE_TAG: version,
      PROJECT_ROOT: runtime.baseDir,
    });

    await this.auditService.log({
      action: 'UPDATE_RUN_REQUESTED',
      severity: 'info',
      message: `Solicitacao de update para versao ${version}`,
      actor: {
        userId: request.userId,
        email: request.userEmail,
        role: request.userRole,
      },
      requestCtx: {
        ip: request.ipAddress,
        userAgent: request.userAgent,
      },
      tenantId: null,
      metadata: {
        operationId,
        fromVersion,
        toVersion: version,
        mode,
        source: 'panel',
        legacyInplace: !!request.legacyInplace,
      },
    });

    await this.auditService.log({
      action: 'UPDATE_STARTED',
      severity: 'warning',
      message: `Update iniciado para versao ${version}`,
      actor: {
        userId: request.userId,
        email: request.userEmail,
        role: request.userRole,
      },
      requestCtx: {
        ip: request.ipAddress,
        userAgent: request.userAgent,
      },
      tenantId: null,
      metadata: {
        operationId,
        fromVersion,
        toVersion: version,
        mode,
        source: 'panel',
      },
    });

    await this.notificationService.emitSystemAlert({
      action: 'UPDATE_STARTED',
      severity: 'warning',
      title: 'Update iniciado',
      body: `Update iniciado para versao ${version}.`,
      data: {
        operationId,
        toVersion: version,
        mode,
      },
      module: 'update',
    });

    this.attachProcessListeners(child, runtime, {
      operationId,
      operationType: 'update',
      requestedBy: request.userId,
      requestedByEmail: request.userEmail,
      requestedByRole: request.userRole,
      requestedFromVersion: fromVersion,
          requestedVersion: version,
          mode,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          requestedAt: this.nowIso(),
        });

    return {
      success: true,
      operationId,
      message: `Update iniciado para versao ${version}.`,
    };
  }

  async runRollback(request: RunOperationRequest): Promise<{
    success: boolean;
    operationId: string;
    message: string;
  }> {
    const runtime = this.resolveRuntimePaths('native');
    this.ensureNativeMode();
    this.ensureScriptExists(runtime.rollbackScriptPath, 'rollback-native.sh');
    await this.assertNoRunningOperation(runtime, true);

    const target = String(request.target || 'previous').trim() || 'previous';
    await this.writeRollbackRunningState(runtime, target);
    await this.appendLog(runtime.logPath, 'rollback', `Rollback solicitado para target ${target}.`);

    const operationId = this.createOperationId('rollback');
    const fromVersion = await this.resolveCurrentVersion(runtime.baseDir);
    const args = [runtime.rollbackScriptPath, '--to', target];
    const child = this.spawnOperation('rollback', operationId, 'bash', args, runtime);

    await this.auditService.log({
      action: 'UPDATE_ROLLBACK_MANUAL',
      severity: 'critical',
      message: `Solicitacao de rollback para target ${target}`,
      actor: {
        userId: request.userId,
        email: request.userEmail,
        role: request.userRole,
      },
      requestCtx: {
        ip: request.ipAddress,
        userAgent: request.userAgent,
      },
      tenantId: null,
      metadata: {
        operationId,
        source: 'panel',
        targetVersion: target,
        fromVersion,
        toVersion: target,
      },
    });

    this.attachProcessListeners(child, runtime, {
      operationId,
      operationType: 'rollback',
      requestedBy: request.userId,
      requestedByEmail: request.userEmail,
      requestedByRole: request.userRole,
      requestedFromVersion: fromVersion,
      requestedVersion: target,
      mode: 'native',
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      requestedAt: this.nowIso(),
    });

    return {
      success: true,
      operationId,
      message: `Rollback iniciado para target ${target}.`,
    };
  }

  async getStatus(): Promise<UpdateState & {
    operation: {
      active: boolean;
      operationId: string | null;
      type: UpdateOperationType | null;
    };
    stale: boolean;
    lockPath: string;
    statePath: string;
  }> {
    const runtime = this.resolveRuntimePaths();
    const state = await this.readState(runtime.statePath);
    const stale = this.isStaleRunningState(state);

    return {
      ...state,
      operation: {
        active: this.activeProcess !== null,
        operationId: this.activeOperationId,
        type: this.activeOperationType,
      },
      stale,
      lockPath: runtime.lockPath,
      statePath: runtime.statePath,
    };
  }

  async getLogTail(tail = 200): Promise<{
    tail: number;
    totalLines: number;
    lines: string[];
    logPath: string;
  }> {
    const runtime = this.resolveRuntimePaths();
    const safeTail = Number.isFinite(Number(tail))
      ? Math.min(2000, Math.max(1, Number(tail)))
      : 200;

    const logPath = runtime.logPath;
    let content = '';
    try {
      content = await fsp.readFile(logPath, 'utf8');
    } catch {
      return {
        tail: safeTail,
        totalLines: 0,
        lines: [],
        logPath,
      };
    }

    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);

    return {
      tail: safeTail,
      totalLines: lines.length,
      lines: lines.slice(-safeTail),
      logPath,
    };
  }

  async listReleases(): Promise<{
    current: string | null;
    previous: string | null;
    releases: Array<{
      name: string;
      path: string;
      isCurrent: boolean;
      isPrevious: boolean;
      modifiedAt: string | null;
    }>;
    baseDir: string;
  }> {
    const runtime = this.resolveRuntimePaths();
    await this.ensureDir(runtime.releasesDir);

    const currentTarget = await this.safeRealpath(path.join(runtime.baseDir, 'current'));
    const previousTarget = await this.safeRealpath(path.join(runtime.baseDir, 'previous'));

    const entries = await fsp.readdir(runtime.releasesDir, { withFileTypes: true });
    const releaseRows: Array<{
      name: string;
      path: string;
      isCurrent: boolean;
      isPrevious: boolean;
      modifiedAt: string | null;
    }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const fullPath = path.join(runtime.releasesDir, entry.name);
      let modifiedAt: string | null = null;
      try {
        const stat = await fsp.stat(fullPath);
        modifiedAt = stat.mtime.toISOString();
      } catch {
        modifiedAt = null;
      }

      releaseRows.push({
        name: entry.name,
        path: fullPath,
        isCurrent: currentTarget === fullPath,
        isPrevious: previousTarget === fullPath,
        modifiedAt,
      });
    }

    releaseRows.sort((a, b) => {
      const av = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
      const bv = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
      return bv - av;
    });

    return {
      current: currentTarget,
      previous: previousTarget,
      releases: releaseRows,
      baseDir: runtime.baseDir,
    };
  }

  private resolveRuntimePaths(mode: UpdateMode = this.detectInstallationMode()): RuntimePaths {
    const baseDir = this.resolveBaseDir();
    const sharedDir = path.join(baseDir, 'shared');
    const releasesDir = path.join(baseDir, 'releases');
    const statePath = path.join(sharedDir, 'update-state.json');
    const logPath = path.join(sharedDir, 'logs', 'update.log');
    const lockPath = path.join(sharedDir, 'locks', 'update.lock');

    const updateScriptCandidates =
      mode === 'docker'
        ? [
            path.join(baseDir, 'current', 'install', 'update-images.sh'),
            path.join(this.pathsService.getProjectRoot(), 'install', 'update-images.sh'),
            path.join(baseDir, 'install', 'update-images.sh'),
          ]
        : [
            path.join(baseDir, 'current', 'install', 'update-native.sh'),
            path.join(this.pathsService.getProjectRoot(), 'install', 'update-native.sh'),
            path.join(baseDir, 'install', 'update-native.sh'),
          ];
    const rollbackScriptCandidates = [
      path.join(baseDir, 'current', 'install', 'rollback-native.sh'),
      path.join(this.pathsService.getProjectRoot(), 'install', 'rollback-native.sh'),
      path.join(baseDir, 'install', 'rollback-native.sh'),
    ];

    return {
      baseDir,
      sharedDir,
      releasesDir,
      statePath,
      logPath,
      lockPath,
      updateScriptPath: this.pickExistingPath(updateScriptCandidates),
      rollbackScriptPath: this.pickExistingPath(rollbackScriptCandidates),
      mode,
    };
  }

  private detectInstallationMode(): UpdateMode {
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
      this.logger.warn(`Falha ao detectar modo de instalacao automaticamente: ${String(error)}`);
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

  private pickExistingPath(candidates: string[]): string {
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return candidates[0];
  }

  private ensureScriptExists(scriptPath: string, label: string): void {
    if (!fs.existsSync(scriptPath)) {
      throw new HttpException(
        `Script ${label} nao encontrado em ${scriptPath}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private ensureNativeMode(): void {
    if (this.detectInstallationMode() === 'docker') {
      throw new HttpException(
        'Operacao disponivel somente para instalacao nativa.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async assertNoRunningOperation(runtime: RuntimePaths, raiseConflict = false): Promise<void> {
    const state = await this.readState(runtime.statePath);
    const runningByState = state.status === 'running' && state.lock;
    const runningInMemory = this.activeProcess !== null;
    const staleState = runningByState && this.isStaleRunningState(state) && !runningInMemory;

    if (staleState) {
      await this.mergeState(runtime.statePath, {
        status: 'failed',
        finishedAt: this.nowIso(),
        step: 'stale-lock-recovered',
        progress: 100,
        lock: false,
        lastError: state.lastError || 'Lock de atualizacao stale detectado e liberado automaticamente.',
        errorCode: 'UPDATE_STATUS_PERSISTENCE_ERROR',
        errorCategory: 'UPDATE_STATUS_PERSISTENCE_ERROR',
        errorStage: 'lock',
        exitCode: null,
        userMessage: 'Uma atualizacao anterior ficou presa e o lock foi recuperado.',
        technicalMessage: state.lastError || 'stale lock auto-recovered',
      });
      return;
    }

    if (!runningByState && !runningInMemory) {
      return;
    }

    if (!raiseConflict) {
      return;
    }

    throw new HttpException(
      {
        message: 'Update em andamento (lock ativo).',
        state,
        operation: {
          active: runningInMemory,
          operationId: this.activeOperationId,
          type: this.activeOperationType,
        },
      },
      HttpStatus.CONFLICT,
    );
  }

  private spawnOperation(
    operationType: UpdateOperationType,
    operationId: string,
    command: string,
    args: string[],
    runtime: RuntimePaths,
    extraEnv: NodeJS.ProcessEnv = {},
  ): ChildProcessWithoutNullStreams {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      APP_BASE_DIR: runtime.baseDir,
      UPLOADS_DIR: path.join(runtime.sharedDir, 'uploads'),
      BACKUP_DIR: path.join(runtime.sharedDir, 'backups'),
      ...extraEnv,
    };

    const child = spawn(command, args, {
      cwd: runtime.baseDir,
      env,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.activeProcess = child;
    this.activeOperationId = operationId;
    this.activeOperationType = operationType;
    return child;
  }

  private attachProcessListeners(
    child: ChildProcessWithoutNullStreams,
    runtime: RuntimePaths,
    meta: {
      operationId: string;
      operationType: UpdateOperationType;
      requestedBy: string;
      requestedByEmail?: string;
      requestedByRole?: string;
      requestedFromVersion?: string;
      requestedVersion: string;
      mode: UpdateMode;
      ipAddress?: string;
      userAgent?: string;
      requestedAt: string;
    },
  ): void {
    const baseMetadata = {
      operationId: meta.operationId,
      operationType: meta.operationType,
      fromVersion: meta.requestedFromVersion || null,
      toVersion: meta.requestedVersion,
      mode: meta.mode,
      source: 'panel',
    };

    child.stdout.on('data', (chunk) => {
      const output = chunk.toString().trim();
      if (output) {
        this.logger.log(`[${meta.operationType}] ${output}`);
        if (meta.operationType === 'rollback') {
          void this.appendLog(runtime.logPath, 'rollback', output);
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      const output = chunk.toString().trim();
      if (output) {
        this.logger.warn(`[${meta.operationType}] ${output}`);
        if (meta.operationType === 'rollback') {
          void this.appendLog(runtime.logPath, 'rollback', `ERROR: ${output}`);
        }
      }
    });

    child.on('error', async (error) => {
      const errorMessage = String(error);
      const descriptor = this.resolveFailureDescriptor(meta.operationType, 40, meta.operationType);
      if (meta.operationType === 'rollback') {
        await this.writeRollbackFailedState(runtime, `Falha ao executar rollback: ${errorMessage}`);
        await this.appendLog(runtime.logPath, 'rollback', `ERROR: Falha ao executar rollback: ${errorMessage}`);
      } else {
        await this.mergeState(runtime.statePath, {
          status: 'failed',
          finishedAt: this.nowIso(),
          step: meta.operationType,
          progress: 100,
          lock: false,
          lastError: errorMessage,
          errorCode: descriptor.code,
          errorCategory: descriptor.category,
          errorStage: descriptor.stage,
          exitCode: null,
          userMessage: descriptor.userMessage,
          technicalMessage: errorMessage,
        });
        await this.appendLog(runtime.logPath, 'update', `ERROR: Falha ao executar script: ${errorMessage}`);
      }

      this.logger.error(
        `[${meta.operationType}] erro ao executar script (operationId=${meta.operationId}): ${errorMessage}`,
      );

      const eventMetadata = {
        ...baseMetadata,
        exitCode: null,
        hint: null,
        durationSeconds: this.computeDurationSeconds(meta.requestedAt, this.nowIso()),
        stateStatus: 'failed',
        stateStep: meta.operationType,
        lastError: this.sanitizeAuditError(errorMessage),
        errorCode: descriptor.code,
        errorCategory: descriptor.category,
        errorStage: descriptor.stage,
        rollbackAttempted: false,
        rollbackCompleted: false,
      };

      await this.auditService.log({
        action: 'UPDATE_FAILED',
        severity: 'critical',
        message: `Falha ao executar ${meta.operationType}`,
        actor: {
          userId: meta.requestedBy,
          email: meta.requestedByEmail,
          role: meta.requestedByRole,
        },
        requestCtx: {
          ip: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        tenantId: null,
        metadata: eventMetadata,
      });

      await this.notificationService.emitSystemAlert({
        action: 'UPDATE_FAILED',
        severity: 'critical',
        title: 'Update falhou',
        body: `Falha ao executar ${meta.operationType}.`,
        data: eventMetadata,
        module: 'update',
      });

      this.clearActiveOperation();
    });

    child.on('close', async (code) => {
      const exitCode = Number(code ?? -1);
      const hint = this.mapExitCodeToHint(exitCode);
      const descriptor = this.resolveFailureDescriptor(meta.operationType, exitCode, meta.operationType);

      if (meta.operationType === 'rollback') {
        if (exitCode === 0) {
          await this.writeRollbackSuccessState(runtime, meta.requestedVersion);
          await this.appendLog(runtime.logPath, 'rollback', 'Rollback concluido com sucesso.');
        } else {
          const errorMsg = hint || `Rollback finalizado com erro (code=${exitCode}).`;
          await this.writeRollbackFailedState(runtime, errorMsg);
          await this.appendLog(runtime.logPath, 'rollback', `ERROR: ${errorMsg}`);
        }
      }

      let state = await this.readState(runtime.statePath);
      if (meta.operationType === 'update') {
        if (exitCode === 0 && state.status !== 'success' && state.status !== 'rolled_back') {
          state = await this.mergeState(runtime.statePath, {
            status: 'success',
            finishedAt: this.nowIso(),
            step: 'completed',
            progress: 100,
            lock: false,
            lastError: null,
            errorCode: null,
            errorCategory: null,
            errorStage: null,
            exitCode,
            userMessage: null,
            technicalMessage: null,
          });
        } else if (exitCode !== 0) {
          const isRolledBack = state.status === 'rolled_back' || exitCode === 50 || exitCode === 2;
          state = await this.mergeState(runtime.statePath, {
            status: isRolledBack ? 'rolled_back' : 'failed',
            finishedAt: this.nowIso(),
            step: isRolledBack ? 'rollback' : state.step || 'failed',
            progress: 100,
            lock: false,
            lastError: state.lastError || hint || `Atualizacao finalizada com erro (code=${exitCode})`,
            errorCode: descriptor.code,
            errorCategory: descriptor.category,
            errorStage: descriptor.stage,
            exitCode,
            userMessage: descriptor.userMessage,
            technicalMessage: state.lastError || hint || `exitCode=${exitCode}`,
          });
        }
      }

      if (exitCode === 0) {
        this.logger.log(
          `[${meta.operationType}] concluido com sucesso (operationId=${meta.operationId}, state=${state.status})`,
        );
      } else {
        this.logger.warn(
          `[${meta.operationType}] finalizado com erro (code=${exitCode})` +
            (hint ? ` ${hint}` : '') +
            ` operationId=${meta.operationId}`,
        );
      }

      let action = 'UPDATE_FAILED';
      let severity: 'warning' | 'critical' = 'critical';
      let title = 'Update falhou';
      let message = 'Falha durante update';

      if (meta.operationType === 'rollback') {
        if (exitCode === 0) {
          action = 'UPDATE_ROLLBACK_MANUAL';
          title = 'Rollback manual concluido';
          message = `Rollback manual concluido para target ${meta.requestedVersion}.`;
        } else {
          action = 'UPDATE_FAILED';
          title = 'Rollback manual falhou';
          message = `Rollback manual falhou para target ${meta.requestedVersion}.`;
        }
      } else if (exitCode === 0 && state.status === 'rolled_back') {
        action = 'UPDATE_ROLLED_BACK_AUTO';
        title = 'Rollback automatico executado';
        message = 'Update terminou com rollback automatico para preservar versao anterior.';
      } else if (exitCode === 0) {
        action = 'UPDATE_COMPLETED';
        severity = 'warning';
        title = 'Update concluido';
        message = `Update concluido para versao ${meta.requestedVersion}.`;
      }

      const eventMetadata = {
        ...baseMetadata,
        fromVersion: state.fromVersion || baseMetadata.fromVersion,
        toVersion: state.toVersion || baseMetadata.toVersion,
        exitCode,
        hint,
        durationSeconds: this.computeDurationSeconds(state.startedAt || meta.requestedAt, this.nowIso()),
        stateStatus: state.status,
        stateStep: state.step,
        lastError: this.sanitizeAuditError(state.lastError),
        errorCode: state.errorCode,
        errorCategory: state.errorCategory,
        errorStage: state.errorStage,
        rollbackAttempted: Boolean(state.rollback?.attempted),
        rollbackCompleted: Boolean(state.rollback?.completed),
      };

      await this.auditService.log({
        action,
        severity,
        message,
        actor: {
          userId: meta.requestedBy,
          email: meta.requestedByEmail,
          role: meta.requestedByRole,
        },
        requestCtx: {
          ip: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        tenantId: null,
        metadata: eventMetadata,
      });

      await this.notificationService.emitSystemAlert({
        action,
        severity,
        title,
        body: message,
        data: eventMetadata,
        module: 'update',
      });

      this.clearActiveOperation();
    });
  }

  private clearActiveOperation(): void {
    this.activeProcess = null;
    this.activeOperationId = null;
    this.activeOperationType = null;
  }

  private async readState(statePath: string): Promise<UpdateState> {
    let raw = '';
    try {
      raw = await fsp.readFile(statePath, 'utf8');
    } catch {
      return { ...DEFAULT_UPDATE_STATE };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<UpdateState>;
      const status = this.normalizeStateStatus(parsed.status);
      return {
        status,
        mode: this.normalizeMode(parsed.mode),
        startedAt: this.normalizeNullableString(parsed.startedAt),
        finishedAt: this.normalizeNullableString(parsed.finishedAt),
        fromVersion: this.normalizeString(parsed.fromVersion, 'unknown'),
        toVersion: this.normalizeString(parsed.toVersion, 'unknown'),
        step: this.normalizeString(parsed.step, 'idle'),
        progress: this.normalizeProgress(parsed.progress),
        lock: Boolean(parsed.lock),
        lastError: this.normalizeNullableString(parsed.lastError),
        errorCode: this.normalizeNullableString(parsed.errorCode),
        errorCategory: this.normalizeNullableString(parsed.errorCategory),
        errorStage: this.normalizeNullableString(parsed.errorStage),
        exitCode: this.normalizeNullableNumber(parsed.exitCode),
        userMessage: this.normalizeNullableString(parsed.userMessage),
        technicalMessage: this.normalizeNullableString(parsed.technicalMessage),
        rollback: {
          attempted: Boolean(parsed.rollback?.attempted),
          completed: Boolean(parsed.rollback?.completed),
          reason: this.normalizeNullableString(parsed.rollback?.reason),
        },
      };
    } catch {
      return {
        ...DEFAULT_UPDATE_STATE,
        status: 'failed',
        lastError: 'update-state.json invalido',
        errorCode: 'UPDATE_STATUS_PERSISTENCE_ERROR',
        errorCategory: 'UPDATE_STATUS_PERSISTENCE_ERROR',
        errorStage: 'state-read',
        technicalMessage: 'Arquivo update-state.json invalido',
        userMessage: 'Falha ao ler o estado persistido da atualizacao.',
      };
    }
  }

  private normalizeStateStatus(value: unknown): UpdateStateStatus {
    const allowed: UpdateStateStatus[] = ['idle', 'running', 'success', 'failed', 'rolled_back'];
    const normalized = String(value || '').trim() as UpdateStateStatus;
    if (allowed.includes(normalized)) {
      return normalized;
    }
    return 'idle';
  }

  private normalizeMode(value: unknown): UpdateMode {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'docker' || normalized === 'native') {
      return normalized;
    }
    return this.detectInstallationMode();
  }

  private normalizeString(value: unknown, fallback: string): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  private normalizeNullableString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private normalizeNullableNumber(value: unknown): number | null {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) {
      return null;
    }
    return normalized;
  }

  private normalizeProgress(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    if (numeric < 0) {
      return 0;
    }
    if (numeric > 100) {
      return 100;
    }
    return Math.floor(numeric);
  }

  private isStaleRunningState(state: UpdateState): boolean {
    if (state.status !== 'running' || !state.startedAt) {
      return false;
    }
    const started = new Date(state.startedAt).getTime();
    if (!Number.isFinite(started)) {
      return true;
    }
    const elapsedMs = Date.now() - started;
    return elapsedMs > 60 * 60 * 1000;
  }

  private async safeRealpath(target: string): Promise<string | null> {
    try {
      return await fsp.realpath(target);
    } catch {
      return null;
    }
  }

  private async ensureDir(target: string): Promise<void> {
    await fsp.mkdir(target, { recursive: true });
  }

  private createOperationId(prefix: UpdateOperationType): string {
    const random = Math.random().toString(36).slice(2, 10);
    return `${prefix}-${Date.now()}-${random}`;
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private async appendLog(logPath: string, step: string, message: string): Promise<void> {
    await this.ensureDir(path.dirname(logPath));
    const line = `[${this.nowIso()}] [${step}] ${message}\n`;
    try {
      await fsp.appendFile(logPath, line, 'utf8');
    } catch (error) {
      this.logger.warn(`Falha ao gravar log em ${logPath}: ${String(error)}`);
    }
  }

  private async writeState(statePath: string, state: UpdateState): Promise<void> {
    await this.ensureDir(path.dirname(statePath));
    const tmpPath = `${statePath}.tmp-${process.pid}-${Date.now()}`;
    await fsp.writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await fsp.rename(tmpPath, statePath);
  }

  private async mergeState(statePath: string, patch: Partial<UpdateState>): Promise<UpdateState> {
    const current = await this.readState(statePath);
    const merged: UpdateState = {
      ...current,
      ...patch,
      rollback: {
        ...current.rollback,
        ...(patch.rollback ?? {}),
      },
    };
    merged.progress = this.normalizeProgress(merged.progress);
    await this.writeState(statePath, merged);
    return merged;
  }

  private async writeUpdateRunningState(
    runtime: RuntimePaths,
    fromVersion: string,
    toVersion: string,
  ): Promise<void> {
    await this.mergeState(runtime.statePath, {
      status: 'running',
      mode: runtime.mode,
      startedAt: this.nowIso(),
      finishedAt: null,
      fromVersion,
      toVersion,
      step: 'starting',
      progress: 2,
      lock: true,
      lastError: null,
      errorCode: null,
      errorCategory: null,
      errorStage: null,
      exitCode: null,
      userMessage: null,
      technicalMessage: null,
      rollback: {
        attempted: false,
        completed: false,
        reason: null,
      },
    });
  }

  private async writeRollbackRunningState(runtime: RuntimePaths, target: string): Promise<void> {
    const fromVersion = await this.resolveCurrentVersion(runtime.baseDir);
    await this.mergeState(runtime.statePath, {
      status: 'running',
      mode: 'native',
      startedAt: this.nowIso(),
      finishedAt: null,
      fromVersion,
      toVersion: target,
      step: 'rollback',
      progress: 10,
      lock: true,
      lastError: null,
      errorCode: null,
      errorCategory: null,
      errorStage: null,
      exitCode: null,
      userMessage: null,
      technicalMessage: null,
      rollback: {
        attempted: true,
        completed: false,
        reason: null,
      },
    });
  }

  private async writeRollbackSuccessState(runtime: RuntimePaths, target: string): Promise<void> {
    await this.mergeState(runtime.statePath, {
      status: 'rolled_back',
      mode: 'native',
      finishedAt: this.nowIso(),
      toVersion: target,
      step: 'rollback',
      progress: 100,
      lock: false,
      lastError: null,
      errorCode: 'UPDATE_ROLLBACK_COMPLETED',
      errorCategory: 'UPDATE_RESTART_ERROR',
      errorStage: 'rollback',
      exitCode: 0,
      userMessage: 'Rollback concluido com sucesso.',
      technicalMessage: 'Rollback manual concluido.',
      rollback: {
        attempted: true,
        completed: true,
        reason: null,
      },
    });
  }

  private async writeRollbackFailedState(runtime: RuntimePaths, reason: string): Promise<void> {
    await this.mergeState(runtime.statePath, {
      status: 'failed',
      mode: 'native',
      finishedAt: this.nowIso(),
      step: 'rollback',
      progress: 88,
      lock: false,
      lastError: reason,
      errorCode: 'UPDATE_ROLLBACK_ERROR',
      errorCategory: 'UPDATE_RESTART_ERROR',
      errorStage: 'rollback',
      exitCode: 60,
      userMessage: 'Rollback manual falhou e requer intervencao.',
      technicalMessage: reason,
      rollback: {
        attempted: true,
        completed: false,
        reason,
      },
    });
  }

  private async resolveCurrentVersion(baseDir: string): Promise<string> {
    const currentPath = await this.safeRealpath(path.join(baseDir, 'current'));
    if (!currentPath) {
      return 'unknown';
    }

    try {
      const versionPath = path.join(currentPath, 'VERSION');
      const content = await fsp.readFile(versionPath, 'utf8');
      const version = String(content || '').split(/\r?\n/)[0]?.trim();
      if (version) {
        return version;
      }
    } catch {
      // fallback to release directory name
    }

    return path.basename(currentPath) || 'unknown';
  }

  private computeDurationSeconds(startedAt: string | null, finishedAt: string | null): number | null {
    const started = startedAt ? new Date(startedAt).getTime() : Number.NaN;
    const finished = finishedAt ? new Date(finishedAt).getTime() : Number.NaN;
    if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) {
      return null;
    }
    return Math.floor((finished - started) / 1000);
  }

  private sanitizeAuditError(value: string | null): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return null;
    }

    const withoutSecrets = normalized
      .replace(/(token|secret|password|authorization|api[_-]?key|database[_-]?url)\s*[:=]\s*[^,\s]+/gi, '$1=[redacted]')
      .replace(/bearer\s+[-a-z0-9._]+/gi, 'bearer [redacted]');

    return withoutSecrets.length > 600 ? `${withoutSecrets.slice(0, 597)}...` : withoutSecrets;
  }

  private mapExitCodeToHint(exitCode: number): string {
    switch (exitCode) {
      case 0:
        return 'Operacao concluida com sucesso.';
      case 10:
        return 'Lock ativo: update em andamento.';
      case 20:
        return 'Falha de backup pre-swap.';
      case 30:
        return 'Falha ao obter codigo da release.';
      case 40:
        return 'Falha em build/migrations/restart.';
      case 50:
        return 'Healthcheck falhou e rollback automatico foi aplicado.';
      case 60:
        return 'Healthcheck falhou e rollback automatico tambem falhou.';
      case 2:
        return 'Deploy reportou rollback automatico.';
      default:
        return '';
    }
  }

  private resolveFailureDescriptor(
    operationType: UpdateOperationType,
    exitCode: number,
    step: string,
  ): UpdateFailureDescriptor {
    if (operationType === 'rollback') {
      return {
        code: 'UPDATE_RESTART_ERROR',
        category: 'UPDATE_RESTART_ERROR',
        stage: 'rollback',
        userMessage: 'Rollback manual falhou e requer intervencao manual.',
      };
    }

    switch (exitCode) {
      case 10:
        return {
          code: 'UPDATE_CONFLICT_ERROR',
          category: 'UPDATE_UNEXPECTED_ERROR',
          stage: 'lock',
          userMessage: 'Ja existe uma atualizacao em andamento.',
        };
      case 20:
        return {
          code: 'UPDATE_BACKUP_ERROR',
          category: 'UPDATE_SCRIPT_ERROR',
          stage: 'backup',
          userMessage: 'Falha ao criar backup antes da atualizacao.',
        };
      case 30:
        return {
          code: 'UPDATE_GIT_PULL_ERROR',
          category: 'UPDATE_GIT_PULL_ERROR',
          stage: 'download',
          userMessage: 'Falha ao baixar a release do repositiorio.',
        };
      case 40:
        return {
          code: 'UPDATE_SCRIPT_ERROR',
          category: 'UPDATE_SCRIPT_ERROR',
          stage: step || 'build',
          userMessage: 'Falha durante build, migracao ou seed da atualizacao.',
        };
      case 50:
      case 2:
        return {
          code: 'UPDATE_RESTART_ERROR',
          category: 'UPDATE_RESTART_ERROR',
          stage: 'healthcheck',
          userMessage: 'A nova versao falhou no healthcheck e o sistema voltou para a versao anterior.',
        };
      case 60:
        return {
          code: 'UPDATE_RESTART_ERROR',
          category: 'UPDATE_RESTART_ERROR',
          stage: 'rollback',
          userMessage: 'A nova versao e o rollback falharam. Intervencao manual obrigatoria.',
        };
      default:
        return {
          code: 'UPDATE_UNEXPECTED_ERROR',
          category: 'UPDATE_UNEXPECTED_ERROR',
          stage: step || 'unknown',
          userMessage: 'A atualizacao falhou por um erro inesperado.',
        };
    }
  }
}
