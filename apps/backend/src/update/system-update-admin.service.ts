import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { AuditService } from '../audit/audit.service';
import { PathsService } from '@core/common/paths/paths.service';

type UpdateStateStatus = 'idle' | 'running' | 'success' | 'failed' | 'rolled_back';

type UpdateState = {
  status: UpdateStateStatus;
  startedAt: string | null;
  finishedAt: string | null;
  fromVersion: string;
  toVersion: string;
  step: string;
  progress: number;
  lock: boolean;
  lastError: string | null;
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
};

const DEFAULT_UPDATE_STATE: UpdateState = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  fromVersion: 'unknown',
  toVersion: 'unknown',
  step: 'idle',
  progress: 0,
  lock: false,
  lastError: null,
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

    const runtime = this.resolveRuntimePaths();
    this.ensureNativeMode();
    this.ensureScriptExists(runtime.updateScriptPath, 'update-native.sh');
    await this.assertNoRunningOperation(runtime, true);

    if (request.legacyInplace) {
      const allowLegacyApi = process.env.UPDATE_ALLOW_LEGACY_INPLACE_API === 'true';
      if (!allowLegacyApi) {
        throw new HttpException(
          'Modo --legacy-inplace nao permitido via API. Habilite UPDATE_ALLOW_LEGACY_INPLACE_API=true para liberar.',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const args = [runtime.updateScriptPath, '--tag', version];
    if (request.legacyInplace) {
      args.push('--legacy-inplace');
    }

    const operationId = this.createOperationId('update');
    const child = this.spawnOperation('update', operationId, 'bash', args, runtime);

    await this.auditService.log({
      action: 'SYSTEM_UPDATE_RUN_REQUESTED',
      userId: request.userId,
      tenantId: null,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      details: {
        operationId,
        version,
        legacyInplace: !!request.legacyInplace,
      },
    });

    this.attachProcessListeners(child, runtime, {
      operationId,
      operationType: 'update',
      requestedBy: request.userId,
      requestedVersion: version,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
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
    const runtime = this.resolveRuntimePaths();
    this.ensureNativeMode();
    this.ensureScriptExists(runtime.rollbackScriptPath, 'rollback-native.sh');
    await this.assertNoRunningOperation(runtime, true);

    const target = String(request.target || 'previous').trim() || 'previous';
    await this.writeRollbackRunningState(runtime, target);
    await this.appendLog(runtime.logPath, 'rollback', `Rollback solicitado para target ${target}.`);

    const operationId = this.createOperationId('rollback');
    const args = [runtime.rollbackScriptPath, '--to', target];
    const child = this.spawnOperation('rollback', operationId, 'bash', args, runtime);

    await this.auditService.log({
      action: 'SYSTEM_UPDATE_ROLLBACK_REQUESTED',
      userId: request.userId,
      tenantId: null,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      details: {
        operationId,
        target,
      },
    });

    this.attachProcessListeners(child, runtime, {
      operationId,
      operationType: 'rollback',
      requestedBy: request.userId,
      requestedVersion: target,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
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

  private resolveRuntimePaths(): RuntimePaths {
    const baseDir = this.resolveBaseDir();
    const sharedDir = path.join(baseDir, 'shared');
    const releasesDir = path.join(baseDir, 'releases');
    const statePath = path.join(sharedDir, 'update-state.json');
    const logPath = path.join(sharedDir, 'logs', 'update.log');
    const lockPath = path.join(sharedDir, 'locks', 'update.lock');

    const updateScriptCandidates = [
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
    };
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
    if (process.env.IS_DOCKER === 'true') {
      throw new HttpException(
        'Endpoints /api/system/update/* estao disponiveis somente para instalacao nativa.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async assertNoRunningOperation(runtime: RuntimePaths, raiseConflict = false): Promise<void> {
    const state = await this.readState(runtime.statePath);
    const runningByState = state.status === 'running' && state.lock;
    const runningInMemory = this.activeProcess !== null;

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
  ): ChildProcessWithoutNullStreams {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      APP_BASE_DIR: runtime.baseDir,
      UPLOADS_DIR: path.join(runtime.sharedDir, 'uploads'),
      BACKUP_DIR: path.join(runtime.sharedDir, 'backups'),
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
      requestedVersion: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): void {
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
      if (meta.operationType === 'rollback') {
        await this.writeRollbackFailedState(runtime, `Falha ao executar rollback: ${String(error)}`);
        await this.appendLog(runtime.logPath, 'rollback', `ERROR: Falha ao executar rollback: ${String(error)}`);
      }
      this.logger.error(
        `[${meta.operationType}] erro ao executar script (operationId=${meta.operationId}): ${String(error)}`,
      );
      await this.auditService.log({
        action: 'SYSTEM_UPDATE_OPERATION_FAILED',
        userId: meta.requestedBy,
        tenantId: null,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        details: {
          operationId: meta.operationId,
          operationType: meta.operationType,
          versionOrTarget: meta.requestedVersion,
          error: String(error),
        },
      });
      this.clearActiveOperation();
    });

    child.on('close', async (code) => {
      const exitCode = Number(code ?? -1);
      const hint = this.mapExitCodeToHint(exitCode);
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
      const state = await this.readState(runtime.statePath);

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

      await this.auditService.log({
        action: exitCode === 0 ? 'SYSTEM_UPDATE_OPERATION_SUCCESS' : 'SYSTEM_UPDATE_OPERATION_FAILED',
        userId: meta.requestedBy,
        tenantId: null,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        details: {
          operationId: meta.operationId,
          operationType: meta.operationType,
          versionOrTarget: meta.requestedVersion,
          exitCode,
          hint,
          stateStatus: state.status,
          stateStep: state.step,
          stateLastError: state.lastError,
        },
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
        startedAt: this.normalizeNullableString(parsed.startedAt),
        finishedAt: this.normalizeNullableString(parsed.finishedAt),
        fromVersion: this.normalizeString(parsed.fromVersion, 'unknown'),
        toVersion: this.normalizeString(parsed.toVersion, 'unknown'),
        step: this.normalizeString(parsed.step, 'idle'),
        progress: this.normalizeProgress(parsed.progress),
        lock: Boolean(parsed.lock),
        lastError: this.normalizeNullableString(parsed.lastError),
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

  private normalizeString(value: unknown, fallback: string): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  private normalizeNullableString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
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

  private async writeRollbackRunningState(runtime: RuntimePaths, target: string): Promise<void> {
    const fromVersion = await this.resolveCurrentVersion(runtime.baseDir);
    await this.mergeState(runtime.statePath, {
      status: 'running',
      startedAt: this.nowIso(),
      finishedAt: null,
      fromVersion,
      toVersion: target,
      step: 'rollback',
      progress: 10,
      lock: true,
      lastError: null,
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
      finishedAt: this.nowIso(),
      toVersion: target,
      step: 'rollback',
      progress: 100,
      lock: false,
      lastError: null,
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
      finishedAt: this.nowIso(),
      step: 'rollback',
      progress: 88,
      lock: false,
      lastError: reason,
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
      default:
        return '';
    }
  }
}
