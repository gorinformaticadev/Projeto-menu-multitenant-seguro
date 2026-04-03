import { ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notification.service';
import { PathsService } from '@core/common/paths/paths.service';

export type TerminalUpdateStatus = 'idle' | 'running' | 'success' | 'failed' | 'lost';

export type TerminalUpdateState = {
  status: TerminalUpdateStatus;
  pid: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  command: string;
  logPath: string | null;
  lastError: string | null;
  triggeredBy: 'panel' | 'terminal' | null;
};

type StartTerminalUpdateRequest = {
  userId: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
};

type TerminalUpdateLogPayload = {
  content: string;
  logPath: string | null;
};

type PersistedUpdateStatusFile = {
  executionId?: string;
  state?: 'running' | 'success' | 'failed';
  step?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  exitCode?: number | null;
  runtimeVersionBefore?: string | null;
  runtimeVersionAfter?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  logPath?: string | null;
  command?: string | null;
};

const PRIMARY_COMMAND = 'sudo -n /usr/local/bin/pluggor-app-update';
const PRIMARY_WRAPPER_PATH = '/usr/local/bin/pluggor-app-update';
const FALLBACK_COMMAND = 'sudo -n /usr/local/bin/pluggor-update';
const FALLBACK_WRAPPER_PATH = '/usr/local/bin/pluggor-update';
const STATUS_PATH = '/var/lib/pluggor/update/current/status.json';

@Injectable()
export class TerminalUpdateRunnerService {
  private readonly logger = new Logger(TerminalUpdateRunnerService.name);
  private activeProcess: ChildProcess | null = null;

  constructor(
    private readonly pathsService: PathsService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async start(request: StartTerminalUpdateRequest): Promise<TerminalUpdateState> {
    const current = this.getStatus();
    if (current.status === 'running') {
      throw new ConflictException('Ja existe uma atualizacao em execucao.');
    }

    const wrapper = this.resolveWrapper();
    if (!wrapper) {
      throw new ServiceUnavailableException('Wrapper de update da plataforma nao encontrado.');
    }

    const startedAt = new Date().toISOString();
    const child = spawn('sudo', ['-n', wrapper.path], {
      cwd: this.pathsService.getProjectRoot(),
      stdio: 'ignore',
      env: {
        ...process.env,
      },
      detached: true,
    });

    this.activeProcess = child;

    await this.auditService.log({
      action: 'UPDATE_STARTED',
      severity: 'warning',
      message: 'Update iniciado via painel usando o wrapper oficial da plataforma.',
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
        command: wrapper.command,
        source: 'panel',
      },
    });

    await this.notificationService.emitSystemAlert({
      action: 'UPDATE_STARTED',
      severity: 'warning',
      title: 'Update iniciado',
      body: 'O painel iniciou o fluxo oficial de update da plataforma.',
      data: {
        command: wrapper.command,
        pid: child.pid ?? null,
      },
      module: 'update',
    });

    child.on('error', (error) => {
      this.logger.warn(`Falha ao iniciar wrapper de update: ${error.message}`);
      this.activeProcess = null;
    });

    child.on('close', () => {
      this.activeProcess = null;
    });

    child.unref();

    const persisted = this.readPersistedStatus();
    if (persisted) {
      return persisted;
    }

    return {
      status: 'running',
      pid: child.pid ?? null,
      startedAt,
      finishedAt: null,
      exitCode: null,
      command: wrapper.command,
      logPath: null,
      lastError: null,
      triggeredBy: 'panel',
    };
  }

  getStatus(): TerminalUpdateState {
    const persisted = this.readPersistedStatus();
    if (persisted) {
      return persisted;
    }

    if (this.activeProcess) {
      return {
        status: 'running',
        pid: this.activeProcess.pid ?? null,
        startedAt: null,
        finishedAt: null,
        exitCode: null,
        command: this.resolveWrapperCommand(),
        logPath: null,
        lastError: null,
        triggeredBy: 'panel',
      };
    }

    return this.defaultState();
  }

  getLogTail(maxLines = 200): TerminalUpdateLogPayload {
    const state = this.getStatus();
    if (!state.logPath || !fs.existsSync(state.logPath)) {
      return {
        content: '',
        logPath: state.logPath,
      };
    }

    const content = fs.readFileSync(state.logPath, 'utf8');
    const lines = content.split(/\r?\n/).filter((line, index, array) => line.length > 0 || index < array.length - 1);
    const tail = lines.slice(Math.max(0, lines.length - Math.max(1, maxLines)));
    return {
      content: tail.join('\n').trim(),
      logPath: state.logPath,
    };
  }

  private readPersistedStatus(): TerminalUpdateState | null {
    if (!fs.existsSync(STATUS_PATH)) {
      return null;
    }

    try {
      const raw = fs.readFileSync(STATUS_PATH, 'utf8');
      const parsed = JSON.parse(raw) as PersistedUpdateStatusFile;
      return {
        status: this.mapPersistedStatus(parsed.state),
        pid: null,
        startedAt: parsed.startedAt ?? null,
        finishedAt: parsed.finishedAt ?? null,
        exitCode: typeof parsed.exitCode === 'number' ? parsed.exitCode : null,
        command: parsed.command || this.resolveWrapperCommand(),
        logPath: parsed.logPath ?? null,
        lastError: parsed.errorMessage ?? null,
        triggeredBy: 'panel',
      };
    } catch (error) {
      this.logger.warn(`Falha ao ler status persistido do update: ${String(error)}`);
      return {
        ...this.defaultState(),
        status: 'failed',
        lastError: 'Falha ao ler o status persistido do update.',
      };
    }
  }

  private mapPersistedStatus(status?: PersistedUpdateStatusFile['state']): TerminalUpdateStatus {
    switch (status) {
      case 'running':
        return 'running';
      case 'success':
        return 'success';
      case 'failed':
        return 'failed';
      default:
        return 'idle';
    }
  }

  private defaultState(): TerminalUpdateState {
    return {
      status: 'idle',
      pid: null,
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      command: this.resolveWrapperCommand(),
      logPath: null,
      lastError: null,
      triggeredBy: null,
    };
  }

  private resolveWrapper(): { path: string; command: string } | null {
    if (fs.existsSync(PRIMARY_WRAPPER_PATH)) {
      return {
        path: PRIMARY_WRAPPER_PATH,
        command: PRIMARY_COMMAND,
      };
    }

    if (fs.existsSync(FALLBACK_WRAPPER_PATH)) {
      this.logger.warn('Wrapper legado pluggor-update em uso. Instale pluggor-app-update para concluir a migracao.');
      return {
        path: FALLBACK_WRAPPER_PATH,
        command: FALLBACK_COMMAND,
      };
    }

    return null;
  }

  private resolveWrapperCommand(): string {
    return this.resolveWrapper()?.command || PRIMARY_COMMAND;
  }
}
