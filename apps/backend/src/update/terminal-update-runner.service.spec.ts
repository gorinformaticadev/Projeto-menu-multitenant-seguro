import { EventEmitter } from 'events';
import * as fs from 'fs';
import { TerminalUpdateRunnerService } from './terminal-update-runner.service';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const { spawn } = jest.requireMock('child_process') as { spawn: jest.Mock };

describe('TerminalUpdateRunnerService', () => {
  let service: TerminalUpdateRunnerService;
  let originalExistsSync: typeof fs.existsSync;
  let originalReadFileSync: typeof fs.readFileSync;

  beforeEach(() => {
    originalExistsSync = fs.existsSync.bind(fs);
    originalReadFileSync = fs.readFileSync.bind(fs);
    service = new TerminalUpdateRunnerService(
      {
        getProjectRoot: () => '/workspace/pluggor',
      } as any,
      {
        log: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        emitSystemAlert: jest.fn().mockResolvedValue(undefined),
      } as any,
    );

    jest.spyOn(fs, 'existsSync').mockImplementation((targetPath: fs.PathLike) => {
      if (
        String(targetPath) === '/usr/local/bin/pluggor-app-update' ||
        String(targetPath) === '/usr/local/bin/pluggor-update'
      ) {
        return true;
      }
      return originalExistsSync(targetPath);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    spawn.mockReset();
  });

  it('inicia o wrapper oficial da plataforma', async () => {
    const child = new EventEmitter() as any;
    child.pid = 4321;
    child.on = child.addListener.bind(child);
    child.unref = jest.fn();
    spawn.mockReturnValue(child);

    const state = await service.start({ userId: 'super-1' });

    expect(spawn).toHaveBeenCalledWith(
      'sudo',
      ['-n', '/usr/local/bin/pluggor-app-update'],
      expect.objectContaining({
        cwd: '/workspace/pluggor',
        detached: true,
        stdio: 'ignore',
      }),
    );
    expect(state.status).toBe('running');
    expect(state.pid).toBe(4321);
    expect(child.unref).toHaveBeenCalled();
  });

  it('le o status persistido em /var/lib/pluggor/update/current/status.json', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((targetPath: fs.PathLike) => {
      if (
        String(targetPath) === '/usr/local/bin/pluggor-app-update' ||
        String(targetPath) === '/usr/local/bin/pluggor-update'
      ) {
        return true;
      }
      if (String(targetPath) === '/var/lib/pluggor/update/current/status.json') {
        return true;
      }
      return false;
    });

    jest.spyOn(fs, 'readFileSync').mockImplementation((targetPath: fs.PathOrFileDescriptor, options?: any) => {
      if (String(targetPath) === '/var/lib/pluggor/update/current/status.json') {
        return JSON.stringify({
          state: 'success',
          startedAt: '2026-04-03T10:00:00Z',
          finishedAt: '2026-04-03T10:03:00Z',
          exitCode: 0,
          logPath: '/var/lib/pluggor/update/history/exec-1.log',
          command: 'sudo -n /usr/local/bin/pluggor-app-update',
        });
      }
      return originalReadFileSync(targetPath as any, options);
    });

    const state = service.getStatus();

    expect(state.status).toBe('success');
    expect(state.exitCode).toBe(0);
    expect(state.logPath).toBe('/var/lib/pluggor/update/history/exec-1.log');
  });

  it('retorna idle quando ainda nao existe status persistido', () => {
    const state = service.getStatus();
    expect(state.status).toBe('idle');
    expect(state.logPath).toBeNull();
  });

  it('retorna o tail do log apontado pelo status persistido', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation((targetPath: fs.PathLike) => {
      if (
        String(targetPath) === '/usr/local/bin/pluggor-app-update' ||
        String(targetPath) === '/usr/local/bin/pluggor-update'
      ) {
        return true;
      }
      if (
        String(targetPath) === '/var/lib/pluggor/update/current/status.json' ||
        String(targetPath) === '/var/lib/pluggor/update/history/exec-1.log'
      ) {
        return true;
      }
      return false;
    });

    jest.spyOn(fs, 'readFileSync').mockImplementation((targetPath: fs.PathOrFileDescriptor, options?: any) => {
      if (String(targetPath) === '/var/lib/pluggor/update/current/status.json') {
        return JSON.stringify({
          state: 'running',
          startedAt: '2026-04-03T10:00:00Z',
          finishedAt: null,
          exitCode: null,
          logPath: '/var/lib/pluggor/update/history/exec-1.log',
        });
      }
      if (String(targetPath) === '/var/lib/pluggor/update/history/exec-1.log') {
        return 'linha 1\nlinha 2\nlinha 3\nlinha 4\n';
      }
      return originalReadFileSync(targetPath as any, options);
    });

    const tail = service.getLogTail(2);

    expect(tail.logPath).toBe('/var/lib/pluggor/update/history/exec-1.log');
    expect(tail.content).toBe('linha 3\nlinha 4');
  });

  it('usa o wrapper legado como fallback quando o wrapper novo ainda nao existe', async () => {
    const child = new EventEmitter() as any;
    child.pid = 9876;
    child.on = child.addListener.bind(child);
    child.unref = jest.fn();
    spawn.mockReturnValue(child);

    jest.spyOn(fs, 'existsSync').mockImplementation((targetPath: fs.PathLike) => {
      if (String(targetPath) === '/usr/local/bin/pluggor-app-update') {
        return false;
      }
      if (String(targetPath) === '/usr/local/bin/pluggor-update') {
        return true;
      }
      return false;
    });

    const state = await service.start({ userId: 'super-2' });

    expect(spawn).toHaveBeenCalledWith(
      'sudo',
      ['-n', '/usr/local/bin/pluggor-update'],
      expect.objectContaining({
        cwd: '/workspace/pluggor',
      }),
    );
    expect(state.command).toBe('sudo -n /usr/local/bin/pluggor-update');
  });
});
