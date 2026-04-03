import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TerminalUpdateRunnerService } from './terminal-update-runner.service';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const { spawn } = jest.requireMock('child_process') as { spawn: jest.Mock };

describe('TerminalUpdateRunnerService', () => {
  let tempDir: string;
  let service: TerminalUpdateRunnerService;
  let originalExistsSync: typeof fs.existsSync;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-update-runner-'));
    originalExistsSync = fs.existsSync.bind(fs);
    service = new TerminalUpdateRunnerService(
      {
        getProjectRoot: () => tempDir,
        getTempDir: () => tempDir,
      } as any,
      {
        log: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        emitSystemAlert: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    jest.spyOn(fs, 'existsSync').mockImplementation((targetPath: fs.PathLike) => {
      if (String(targetPath) === '/usr/local/bin/pluggor-update') {
        return true;
      }
      return originalExistsSync(targetPath);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    spawn.mockReset();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('persiste status running ao iniciar o processo oficial', async () => {
    const child = new EventEmitter() as any;
    child.pid = 4321;
    child.on = child.addListener.bind(child);
    child.unref = jest.fn();
    spawn.mockReturnValue(child);
    jest.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      void pid;
      void signal;
      return true;
    }) as typeof process.kill);

    const state = await service.start({ userId: 'super-1' });

    expect(spawn).toHaveBeenCalledWith(
      'sudo',
      ['-n', '/usr/local/bin/pluggor-update'],
      expect.objectContaining({
        cwd: tempDir,
        detached: true,
      }),
    );
    expect(state.status).toBe('running');
    expect(state.pid).toBe(4321);
    expect(service.getStatus().status).toBe('running');
    expect(child.unref).toHaveBeenCalled();
  });

  it('mantem running quando o estado persistido aponta para um pid ainda vivo', () => {
    const runtimeDir = path.join(tempDir, 'terminal-update');
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(
      path.join(runtimeDir, 'terminal-update-state.json'),
      JSON.stringify({
        status: 'running',
        pid: 99999,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        exitCode: null,
        command: 'sudo -n /usr/local/bin/pluggor-update',
        logPath: null,
        lastError: null,
        triggeredBy: 'panel',
      }),
      'utf8',
    );

    jest.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      void pid;
      void signal;
      return true;
    }) as typeof process.kill);

    const state = service.getStatus();

    expect(state.status).toBe('running');
  });

  it('marca lost quando o backend perde o vinculo e o pid nao existe mais', () => {
    const runtimeDir = path.join(tempDir, 'terminal-update');
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(
      path.join(runtimeDir, 'terminal-update-state.json'),
      JSON.stringify({
        status: 'running',
        pid: 99999,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        exitCode: null,
        command: 'sudo -n /usr/local/bin/pluggor-update',
        logPath: null,
        lastError: null,
        triggeredBy: 'panel',
      }),
      'utf8',
    );

    jest.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      void pid;
      void signal;
      throw new Error('ESRCH');
    }) as typeof process.kill);

    const state = service.getStatus();

    expect(state.status).toBe('lost');
    expect(state.lastError).toMatch(/perdeu o estado final|nao esta mais em execucao/i);
  });
});
