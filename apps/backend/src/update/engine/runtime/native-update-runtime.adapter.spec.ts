import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { NativeUpdateRuntimeAdapter } from './native-update-runtime.adapter';
import type { UpdateExecutionRecord } from '../update-execution.types';
import type { UpdateRuntimePaths } from './update-runtime-adapter.interface';

function createExecution(): UpdateExecutionRecord {
  return {
    id: 'execution-native-1',
    installationId: 'host-1',
    requestedBy: 'super-1',
    source: 'panel',
    mode: 'native',
    currentVersion: 'v1.0.0',
    targetVersion: 'v1.2.3',
    status: 'running',
    currentStep: 'fetch_code',
    failedStep: null,
    rollbackPolicy: 'code_only_safe',
    progressUnitsDone: 2,
    progressUnitsTotal: 14,
    error: null,
    metadata: {},
    requestedAt: '2026-03-29T00:00:00.000Z',
    startedAt: '2026-03-29T00:00:01.000Z',
    finishedAt: null,
    revision: 1,
    createdAt: '2026-03-29T00:00:00.000Z',
    updatedAt: '2026-03-29T00:00:01.000Z',
  };
}

describe('NativeUpdateRuntimeAdapter', () => {
  let tmpDir: string;
  let sourceDir: string;
  let runtime: UpdateRuntimePaths;
  let metadata: Record<string, unknown>;
  let pm2JlistOutput: string;
  let failFrontendRestart: boolean;

  const commandRunnerMock = {
    run: jest.fn(async (request: any) => {
      const args = Array.isArray(request.args) ? request.args : [];
      const cwd = String(request.cwd || '');
      const joinedArgs = args.join(' ');

      if (request.command === 'pm2' && joinedArgs === 'jlist') {
        return {
          commandRunId: 'cmd-pm2-jlist',
          exitCode: 0,
          stdout: pm2JlistOutput,
          stderr: '',
          stdoutPath: null,
          stderrPath: null,
        };
      }

      if (
        request.command === 'pm2' &&
        joinedArgs.includes('--name multitenant-frontend') &&
        failFrontendRestart
      ) {
        return {
          commandRunId: 'cmd-pm2-frontend-fail',
          exitCode: 1,
          stdout: '',
          stderr: 'frontend restart failed',
          stdoutPath: null,
          stderrPath: null,
        };
      }

      if (request.command === 'pnpm' && args.join(' ').includes('--filter frontend build')) {
        const frontendDir = path.join(cwd, 'apps', 'frontend');
        fs.mkdirSync(path.join(frontendDir, '.next', 'standalone', '.next'), { recursive: true });
        fs.mkdirSync(path.join(frontendDir, '.next', 'static'), { recursive: true });
        fs.writeFileSync(path.join(frontendDir, '.next', 'BUILD_ID'), 'build-123');
        fs.writeFileSync(path.join(frontendDir, '.next', 'standalone', '.next', 'BUILD_ID'), 'build-123');
        fs.writeFileSync(path.join(frontendDir, '.next', 'standalone', 'server.js'), 'console.log("frontend");');
        fs.writeFileSync(path.join(frontendDir, '.next', 'static', 'main.js'), 'console.log("asset");');
      }

      if (request.command === 'pnpm' && args.join(' ').includes('--filter backend build')) {
        const backendDir = path.join(cwd, 'apps', 'backend', 'dist');
        fs.mkdirSync(backendDir, { recursive: true });
        fs.writeFileSync(path.join(backendDir, 'main.js'), 'console.log("backend");');
      }

      return {
        commandRunId: `cmd-${request.step}`,
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
        stdoutPath: null,
        stderrPath: null,
      };
    }),
    startBackground: jest.fn(async () => ({
      commandRunId: 'bg-1',
      stdoutPath: null,
      stderrPath: null,
      child: {} as any,
      stop: async () => 0,
    })),
    recordInternalOperation: jest.fn(async () => 'internal-1'),
  };

  const probeServiceMock = {
    waitForReady: jest.fn(async () => undefined),
    fetchText: jest.fn(async (url: string) => {
      if (url.includes('/api/health')) {
        return '{"ok":true}';
      }

      if (url.includes('/_next/static/')) {
        return 'asset';
      }

      return '<html><script src="/_next/static/main.js"></script></html>';
    }),
  };

  const createAdapter = () =>
    new NativeUpdateRuntimeAdapter(commandRunnerMock as any, probeServiceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
    pm2JlistOutput = JSON.stringify([
      {
        name: 'multitenant-backend',
        pm2_env: {
          status: 'online',
          pm_id: 0,
        },
      },
      {
        name: 'multitenant-frontend',
        pm2_env: {
          status: 'online',
          pm_id: 1,
        },
      },
    ]);
    failFrontendRestart = false;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluggor-native-adapter-'));
    sourceDir = path.join(tmpDir, 'source');
    fs.mkdirSync(path.join(sourceDir, 'apps', 'backend'), { recursive: true });
    fs.mkdirSync(path.join(sourceDir, 'apps', 'frontend', 'public'), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'apps', 'backend', 'package.json'), '{}');
    fs.writeFileSync(path.join(sourceDir, 'apps', 'frontend', 'package.json'), '{}');
    fs.writeFileSync(path.join(sourceDir, 'apps', 'frontend', 'public', 'clear-cache.html'), '<html></html>');

    fs.mkdirSync(path.join(tmpDir, 'install'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'install', 'update-native.sh'), '#!/usr/bin/env bash\n');
    fs.writeFileSync(path.join(tmpDir, 'install', 'rollback-native.sh'), '#!/usr/bin/env bash\n');

    fs.mkdirSync(path.join(tmpDir, 'shared'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'shared', '.env'), 'PORT=4000\nREDIS_HOST=127.0.0.1\nREDIS_PORT=6379\n');
    fs.writeFileSync(path.join(tmpDir, 'shared', '.env.frontend.local'), 'NEXT_PUBLIC_API_URL=/api\n');

    const currentRelease = path.join(tmpDir, 'releases', 'current-release');
    const previousRelease = path.join(tmpDir, 'releases', 'previous-release');
    fs.mkdirSync(currentRelease, { recursive: true });
    fs.mkdirSync(previousRelease, { recursive: true });
    fs.symlinkSync(currentRelease, path.join(tmpDir, 'current'), 'junction');
    fs.symlinkSync(previousRelease, path.join(tmpDir, 'previous'), 'junction');

    runtime = {
      baseDir: tmpDir,
      sharedDir: path.join(tmpDir, 'shared'),
      releasesDir: path.join(tmpDir, 'releases'),
      currentDir: path.join(tmpDir, 'current'),
      previousDir: path.join(tmpDir, 'previous'),
      logsDir: path.join(tmpDir, 'shared', 'logs', 'update-engine', 'execution-native-1'),
      updateScriptPath: path.join(tmpDir, 'install', 'update-native.sh'),
      rollbackScriptPath: path.join(tmpDir, 'install', 'rollback-native.sh'),
      mode: 'native',
      detectedMode: 'native',
    };

    metadata = {
      localSourcePath: sourceDir,
    };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('executa todas as etapas do pipeline native com sucesso', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const steps = [
      'fetch_code',
      'install_dependencies',
      'build_backend',
      'build_frontend',
      'migrate',
      'seed',
      'pre_switch_validation',
      'switch_release',
      'restart_services',
      'healthcheck',
      'post_validation',
      'cleanup',
    ] as const;

    for (const step of steps) {
      const result = await adapter.executeStep(step, {
        execution,
        runtime,
        metadata,
      });
      metadata = {
        ...metadata,
        ...(result.metadata || {}),
      };
    }

    const targetReleaseDir = String(metadata.targetReleaseDir);
    expect(targetReleaseDir).toContain(path.join('releases', 'v1.2.3'));
    expect(fs.existsSync(path.join(targetReleaseDir, 'apps', 'frontend', '.next', 'standalone', 'server.js'))).toBe(true);
    expect(fs.existsSync(String(metadata.currentReleaseRef))).toBe(true);
    expect(commandRunnerMock.startBackground).toHaveBeenCalled();
    expect(probeServiceMock.waitForReady).toHaveBeenCalled();
  });

  it('fetch_code retorna evidencias estruturadas da release preparada', async () => {
    const adapter = createAdapter();
    const execution = createExecution();

    const result = await adapter.executeStep('fetch_code', {
      execution,
      runtime,
      metadata,
    });

    expect(result.metadata).toMatchObject({
      targetReleaseDir: expect.stringContaining(path.join('releases', 'v1.2.3')),
      targetReleaseResolvedVersion: 'v1.2.3',
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'release_preparada',
        }),
        expect.objectContaining({
          code: 'manifestos_detectados',
        }),
      ]),
    );
  });

  it('switch_release confirma a troca efetiva do ponteiro current', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    fs.mkdirSync(targetReleaseDir, { recursive: true });

    const result = await adapter.executeStep('switch_release', {
      execution,
      runtime,
      metadata: {
        targetReleaseDir,
      },
    });
    const observedCurrentReleaseRef = fs.realpathSync(runtime.currentDir);

    expect(result.result).toMatchObject({
      currentReleaseRef: targetReleaseDir,
    });
    expect(String((result.result as Record<string, unknown>).observedCurrentReleaseRef)).toContain(
      path.join('releases', 'v1.2.3'),
    );
    expect(observedCurrentReleaseRef).toContain(path.join('releases', 'v1.2.3'));
  });

  it('switch_release falha antes da confirmação quando o ponteiro observado diverge', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    const unexpectedDir = path.join(runtime.releasesDir, 'unexpected-release');
    fs.mkdirSync(targetReleaseDir, { recursive: true });
    fs.mkdirSync(unexpectedDir, { recursive: true });
    const originalRealpath = fsp.realpath.bind(fsp);

    const realpathSpy = jest.spyOn(fsp, 'realpath').mockImplementation(async (targetPath: any) => {
      if (String(targetPath) === runtime.currentDir) {
        return unexpectedDir;
      }

      return await originalRealpath(targetPath);
    });

    await expect(
      adapter.executeStep('switch_release', {
        execution,
        runtime,
        metadata: {
          targetReleaseDir,
        },
      }),
    ).rejects.toMatchObject({
      code: 'UPDATE_SWITCH_RELEASE_CONFIRMATION_FAILED',
    });

    realpathSpy.mockRestore();
  });

  it('restart_services native retorna serviços reiniciados com evidência estrutural', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    fs.mkdirSync(path.join(targetReleaseDir, 'apps', 'backend', 'dist'), { recursive: true });
    fs.mkdirSync(path.join(targetReleaseDir, 'apps', 'frontend', '.next', 'standalone'), {
      recursive: true,
    });
    fs.writeFileSync(path.join(targetReleaseDir, 'apps', 'frontend', '.next', 'standalone', 'server.js'), 'console.log("frontend");');

    const result = await adapter.executeStep('restart_services', {
      execution,
      runtime,
      metadata: {
        targetReleaseDir,
      },
    });

    expect(result.result).toMatchObject({
      restartedServices: expect.arrayContaining([
        expect.objectContaining({
          service: 'backend',
        }),
        expect.objectContaining({
          service: 'frontend',
        }),
      ]),
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'servicos_pm2_reiniciados',
        }),
      ]),
    );
  });

  it('restart_services native falha de forma parcial quando um serviço não sobe', async () => {
    failFrontendRestart = true;
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    fs.mkdirSync(path.join(targetReleaseDir, 'apps', 'backend', 'dist'), { recursive: true });
    fs.mkdirSync(path.join(targetReleaseDir, 'apps', 'frontend', '.next', 'standalone'), {
      recursive: true,
    });
    fs.writeFileSync(path.join(targetReleaseDir, 'apps', 'frontend', '.next', 'standalone', 'server.js'), 'console.log("frontend");');

    await expect(
      adapter.executeStep('restart_services', {
        execution,
        runtime,
        metadata: {
          targetReleaseDir,
        },
      }),
    ).rejects.toMatchObject({
      code: 'UPDATE_RESTART_PARTIAL_FAILURE',
      details: expect.objectContaining({
        restartedServices: expect.arrayContaining([
          expect.objectContaining({
            service: 'backend',
          }),
        ]),
        serviceFailures: expect.arrayContaining([
          expect.objectContaining({
            service: 'frontend',
          }),
        ]),
      }),
    });
  });

  it('healthcheck native valida PM2, release ativa e versão observada', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    fs.mkdirSync(targetReleaseDir, { recursive: true });
    fs.writeFileSync(path.join(targetReleaseDir, 'VERSION'), 'v1.2.3\n');
    fs.rmSync(runtime.currentDir, { recursive: true, force: true });
    fs.symlinkSync(targetReleaseDir, runtime.currentDir, 'junction');

    const result = await adapter.executeStep('healthcheck', {
      execution,
      runtime,
      metadata: {
        targetReleaseDir,
      },
    });
    const observedCurrentReleaseRef = fs.realpathSync(runtime.currentDir);

    expect(result.result).toMatchObject({
      observedVersion: 'v1.2.3',
    });
    expect(String((result.result as Record<string, unknown>).observedCurrentReleaseRef)).toContain(
      path.join('releases', 'v1.2.3'),
    );
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'runtime_native_saudavel',
        }),
      ]),
    );
  });

  it('healthcheck native falha de forma estruturada quando os processos não ficam online', async () => {
    pm2JlistOutput = JSON.stringify([
      {
        name: 'multitenant-backend',
        pm2_env: {
          status: 'errored',
          pm_id: 0,
        },
      },
    ]);
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    fs.mkdirSync(targetReleaseDir, { recursive: true });
    fs.writeFileSync(path.join(targetReleaseDir, 'VERSION'), 'v1.2.3\n');
    fs.rmSync(runtime.currentDir, { recursive: true, force: true });
    fs.symlinkSync(targetReleaseDir, runtime.currentDir, 'junction');

    await expect(
      adapter.executeStep('healthcheck', {
        execution,
        runtime,
        metadata: {
          targetReleaseDir,
        },
      }),
    ).rejects.toMatchObject({
      code: 'UPDATE_HEALTHCHECK_PM2_NOT_ONLINE',
    });
  });
});
