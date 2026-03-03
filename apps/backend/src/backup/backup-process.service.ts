import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';

export interface ProcessExecutionResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  commandLine: string;
}

@Injectable()
export class BackupProcessService {
  async runCommand(params: {
    command: string;
    args: string[];
    env?: NodeJS.ProcessEnv;
    timeoutMs: number;
    cwd?: string;
    onStdoutLine?: (line: string) => void;
    onStderrLine?: (line: string) => void;
  }): Promise<ProcessExecutionResult> {
    const {
      command,
      args,
      env,
      timeoutMs,
      cwd,
      onStdoutLine,
      onStderrLine,
    } = params;

    const commandLine = [command, ...args.map((arg) => this.quoteForLog(arg))].join(' ');

    return await new Promise<ProcessExecutionResult>((resolve, reject) => {
      const child = spawn(command, args, {
        env,
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let timedOut = false;

      const killTimer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000);
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        stdout += text;
        const { lines, remainder } = this.extractLines(stdoutBuffer + text);
        stdoutBuffer = remainder;
        for (const line of lines) {
          onStdoutLine?.(line);
        }
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        stderr += text;
        const { lines, remainder } = this.extractLines(stderrBuffer + text);
        stderrBuffer = remainder;
        for (const line of lines) {
          onStderrLine?.(line);
        }
      });

      child.once('error', (error) => {
        clearTimeout(killTimer);
        reject(error);
      });

      child.once('close', (code, signal) => {
        clearTimeout(killTimer);
        if (stdoutBuffer.trim()) {
          onStdoutLine?.(stdoutBuffer.trim());
        }
        if (stderrBuffer.trim()) {
          onStderrLine?.(stderrBuffer.trim());
        }

        if (timedOut) {
          const timeoutError = new Error(`Comando excedeu timeout de ${timeoutMs}ms`);
          (timeoutError as any).result = {
            code,
            signal,
            stdout,
            stderr,
            timedOut: true,
            commandLine,
          } as ProcessExecutionResult;
          reject(timeoutError);
          return;
        }

        if (code !== 0) {
          const commandError = new Error(`Comando terminou com codigo ${code}`);
          (commandError as any).result = {
            code,
            signal,
            stdout,
            stderr,
            timedOut: false,
            commandLine,
          } as ProcessExecutionResult;
          reject(commandError);
          return;
        }

        resolve({
          code,
          signal,
          stdout,
          stderr,
          timedOut: false,
          commandLine,
        });
      });
    });
  }

  sanitizeCommandForLog(command: string, args: string[]): string {
    return [command, ...args.map((arg) => this.quoteForLog(arg))].join(' ');
  }

  private extractLines(content: string): { lines: string[]; remainder: string } {
    const parts = content.split(/\r?\n/);
    const remainder = parts.pop() || '';
    return { lines: parts.filter((line) => line.length > 0), remainder };
  }

  private quoteForLog(value: string): string {
    if (/^[a-zA-Z0-9._\-/:=]+$/.test(value)) {
      return value;
    }
    return `"${value.replace(/"/g, '\\"')}"`;
  }
}
