import { Injectable, Logger } from '@nestjs/common';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { UpdateExecutionRepository } from './update-execution.repository';

type CommandRunRequest = {
  executionId: string;
  step: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  logDir?: string;
  metadata?: Record<string, unknown>;
};

type CommandRunResult = {
  commandRunId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  stdoutPath: string | null;
  stderrPath: string | null;
};

type BackgroundCommandHandle = {
  commandRunId: string;
  stdoutPath: string | null;
  stderrPath: string | null;
  child: ChildProcessWithoutNullStreams;
  stop: () => Promise<number | null>;
};

@Injectable()
export class UpdateCommandRunnerService {
  private readonly logger = new Logger(UpdateCommandRunnerService.name);

  constructor(private readonly repository: UpdateExecutionRepository) {}

  async run(request: CommandRunRequest): Promise<CommandRunResult> {
    const prepared = await this.prepareCommandRun(request);
    const child = spawn(request.command, request.args || [], {
      cwd: request.cwd,
      env: {
        ...process.env,
        ...(request.env || {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdoutChunks.push(text);
      if (prepared.stdoutPath) {
        fs.appendFileSync(prepared.stdoutPath, text);
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderrChunks.push(text);
      if (prepared.stderrPath) {
        fs.appendFileSync(prepared.stderrPath, text);
      }
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code) => resolve(Number(code ?? 1)));
    }).catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.finishCommandRun({
        id: prepared.commandRunId,
        exitCode: 1,
        metadata: {
          runtimeError: message,
        },
      });
      throw error;
    });

    await this.repository.finishCommandRun({
      id: prepared.commandRunId,
      exitCode,
      metadata: {
        stdoutBytes: Buffer.byteLength(stdoutChunks.join(''), 'utf8'),
        stderrBytes: Buffer.byteLength(stderrChunks.join(''), 'utf8'),
      },
    });

    return {
      commandRunId: prepared.commandRunId,
      exitCode,
      stdout: stdoutChunks.join(''),
      stderr: stderrChunks.join(''),
      stdoutPath: prepared.stdoutPath,
      stderrPath: prepared.stderrPath,
    };
  }

  async startBackground(request: CommandRunRequest): Promise<BackgroundCommandHandle> {
    const prepared = await this.prepareCommandRun(request);
    const child = spawn(request.command, request.args || [], {
      cwd: request.cwd,
      env: {
        ...process.env,
        ...(request.env || {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      if (prepared.stdoutPath) {
        fs.appendFileSync(prepared.stdoutPath, chunk.toString());
      }
    });

    child.stderr.on('data', (chunk) => {
      if (prepared.stderrPath) {
        fs.appendFileSync(prepared.stderrPath, chunk.toString());
      }
    });

    let finished = false;
    const finish = async (exitCode: number | null) => {
      if (finished) {
        return;
      }

      finished = true;
      await this.repository.finishCommandRun({
        id: prepared.commandRunId,
        exitCode,
        metadata: {
          background: true,
        },
      });
    };

    child.once('error', async (error) => {
      this.logger.warn(`Falha ao iniciar comando em background: ${String(error)}`);
      await finish(1);
    });

    child.once('close', async (code) => {
      await finish(Number(code ?? 0));
    });

    return {
      commandRunId: prepared.commandRunId,
      stdoutPath: prepared.stdoutPath,
      stderrPath: prepared.stderrPath,
      child,
      stop: async () => {
        if (finished) {
          return null;
        }

        child.kill('SIGTERM');
        const exitCode = await new Promise<number | null>((resolve) => {
          child.once('close', (code) => resolve(code === null ? null : Number(code)));
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 2_000).unref?.();
        });

        await finish(exitCode);
        return exitCode;
      },
    };
  }

  async recordInternalOperation(request: CommandRunRequest & {
    exitCode?: number | null;
    resultMetadata?: Record<string, unknown>;
  }): Promise<string> {
    const prepared = await this.prepareCommandRun(request);
    await this.repository.finishCommandRun({
      id: prepared.commandRunId,
      exitCode: request.exitCode ?? 0,
      metadata: {
        internal: true,
        ...(request.resultMetadata || {}),
      },
    });
    return prepared.commandRunId;
  }

  private async prepareCommandRun(request: CommandRunRequest): Promise<{
    commandRunId: string;
    stdoutPath: string | null;
    stderrPath: string | null;
  }> {
    const commandRunId = randomUUID();
    const stdoutPath = request.logDir
      ? path.join(request.logDir, `${request.step}-${commandRunId}.stdout.log`)
      : null;
    const stderrPath = request.logDir
      ? path.join(request.logDir, `${request.step}-${commandRunId}.stderr.log`)
      : null;

    if (request.logDir) {
      await fsp.mkdir(request.logDir, { recursive: true });
    }

    const persistedCommandRunId = await this.repository.createCommandRun({
      id: commandRunId,
      executionId: request.executionId,
      command: request.command,
      args: request.args || [],
      cwd: request.cwd || null,
      stdoutPath,
      stderrPath,
      metadata: {
        step: request.step,
        ...(request.metadata || {}),
      },
    });

    return {
      commandRunId: persistedCommandRunId,
      stdoutPath,
      stderrPath,
    };
  }
}
