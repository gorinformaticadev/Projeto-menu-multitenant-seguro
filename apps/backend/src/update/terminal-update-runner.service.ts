import { ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
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

const COMMAND = 'sudo -n /usr/local/bin/pluggor-update';
const WRAPPER_PATH = '/usr/local/bin/pluggor-update';

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
    if (current.status === 'running' || (current.status === 'lost' && this.isPidAlive(current.pid))) {
      throw new ConflictException('Ja existe uma atualizacao em execucao.');
    }

    if (!fs.existsSync(WRAPPER_PATH)) {
      throw new ServiceUnavailableException('Wrapper de update native nao encontrado.');
    }

    const runtimeDir = this.getRuntimeDir();
    fs.mkdirSync(runtimeDir, { recursive: true });

    const startedAt = new Date().toISOString();
    const logPath = path.join(runtimeDir, `terminal-update-${Date.now()}.log`);
    const logFd = fs.openSync(logPath, 'a');
    fs.writeSync(logFd, `[UPDATE] startedAt=${startedAt}\n[UPDATE] command=${COMMAND}\n`);

    const child = spawn('sudo', ['-n', WRAPPER_PATH], {
      cwd: this.pathsService.getProjectRoot(),
      stdio: ['ignore', logFd, logFd],
      env: {
        ...process.env,
      },
    });

    this.activeProcess = child;

    const state: TerminalUpdateState = {
      status: 'running',
      pid: child.pid ?? null,
      startedAt,
      finishedAt: null,
      exitCode: null,
      command: COMMAND,
      logPath,
      lastError: null,
      triggeredBy: 'panel',
    };
    this.writeState(state);

    await this.auditService.log({
      action: 'UPDATE_STARTED',
      severity: 'warning',
      message: 'Update iniciado via painel usando o fluxo oficial do terminal.',
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
        command: COMMAND,
        source: 'panel',
      },
    });

    await this.notificationService.emitSystemAlert({
      action: 'UPDATE_STARTED',
      severity: 'warning',
      title: 'Update iniciado',
      body: 'O painel iniciou o fluxo oficial de update do terminal.',
      data: {
        command: COMMAND,
        pid: child.pid ?? null,
      },
      module: 'update',
    });

    child.on('error', (error) => {
      try {
        fs.writeSync(logFd, `[UPDATE] runner_error=${error.message}\n`);
      } finally {
        try {
          fs.closeSync(logFd);
        } catch {
          // noop
        }
      }
      this.activeProcess = null;
      this.writeState({
        ...state,
        status: 'failed',
        finishedAt: new Date().toISOString(),
        exitCode: -1,
        lastError: error.message,
      });
    });

    child.on('close', async (code) => {
      try {
        fs.writeSync(logFd, `[UPDATE] exitCode=${code ?? -1}\n`);
      } finally {
        try {
          fs.closeSync(logFd);
        } catch {
          // noop
        }
      }

      this.activeProcess = null;

      const nextState: TerminalUpdateState = {
        ...state,
        status: code === 0 ? 'success' : 'failed',
        finishedAt: new Date().toISOString(),
        exitCode: code ?? -1,
        lastError: code === 0 ? null : `Processo finalizado com codigo ${code ?? -1}.`,
      };
      this.writeState(nextState);

      try {
        await this.auditService.log({
          action: code === 0 ? 'UPDATE_COMPLETED' : 'UPDATE_FAILED',
          severity: code === 0 ? 'info' : 'error',
          message:
            code === 0
              ? 'Update concluido via painel.'
              : `Update falhou via painel com codigo ${code ?? -1}.`,
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
            command: COMMAND,
            source: 'panel',
            exitCode: code ?? -1,
          },
        });

        await this.notificationService.emitSystemAlert({
          action: code === 0 ? 'UPDATE_COMPLETED' : 'UPDATE_FAILED',
          severity: code === 0 ? 'info' : 'error',
          title: code === 0 ? 'Update concluido' : 'Update falhou',
          body:
            code === 0
              ? 'O fluxo oficial de update terminou com sucesso.'
              : `O fluxo oficial de update terminou com erro (codigo ${code ?? -1}).`,
          data: {
            command: COMMAND,
            exitCode: code ?? -1,
          },
          module: 'update',
        });
      } catch (error) {
        this.logger.warn(`Falha ao registrar auditoria/notificacao do update: ${String(error)}`);
      }
    });

    return state;
  }

  getStatus(): TerminalUpdateState {
    const state = this.readState();
    if (state.status === 'running' && !this.activeProcess) {
      const reconciled: TerminalUpdateState = {
        ...state,
        status: 'lost',
        lastError: 'O backend perdeu o vinculo com o processo de update em execucao.',
      };
      this.writeState(reconciled);
      return reconciled;
    }
    return state;
  }

  getLogTail(maxLines = 200): TerminalUpdateLogPayload {
    const state = this.readState();
    if (!state.logPath || !fs.existsSync(state.logPath)) {
      return {
        content: '',
        logPath: state.logPath,
      };
    }

    const content = fs.readFileSync(state.logPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const tail = lines.slice(Math.max(0, lines.length - Math.max(1, maxLines)));
    return {
      content: tail.join('\n').trim(),
      logPath: state.logPath,
    };
  }

  private getRuntimeDir(): string {
    return path.join(this.pathsService.getTempDir(), 'terminal-update');
  }

  private getStatePath(): string {
    return path.join(this.getRuntimeDir(), 'terminal-update-state.json');
  }

  private readState(): TerminalUpdateState {
    const statePath = this.getStatePath();
    if (!fs.existsSync(statePath)) {
      return this.defaultState();
    }

    try {
      const raw = fs.readFileSync(statePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<TerminalUpdateState>;
      return {
        ...this.defaultState(),
        ...parsed,
      };
    } catch (error) {
      this.logger.warn(`Falha ao ler estado persistido do update: ${String(error)}`);
      return {
        ...this.defaultState(),
        status: 'failed',
        lastError: 'Falha ao ler o estado persistido do update.',
      };
    }
  }

  private writeState(state: TerminalUpdateState): void {
    const runtimeDir = this.getRuntimeDir();
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(this.getStatePath(), JSON.stringify(state, null, 2), 'utf8');
  }

  private defaultState(): TerminalUpdateState {
    return {
      status: 'idle',
      pid: null,
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      command: COMMAND,
      logPath: null,
      lastError: null,
      triggeredBy: null,
    };
  }

  private isPidAlive(pid: number | null): boolean {
    if (!pid || pid <= 0) {
      return false;
    }

    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }
}
