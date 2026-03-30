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

function createMockFrontendStandaloneBuild(frontendDir: string) {
  const sourceBuildDir = path.join(frontendDir, '.next');
  const runtimeDir = path.join(sourceBuildDir, 'standalone', 'apps', 'frontend');
  const standaloneBuildDir = path.join(runtimeDir, '.next');
  const sourceServerDir = path.join(sourceBuildDir, 'server', 'app', 'login');
  const standaloneServerDir = path.join(standaloneBuildDir, 'server', 'app', 'login');

  fs.mkdirSync(standaloneBuildDir, { recursive: true });
  fs.mkdirSync(path.join(sourceBuildDir, 'static'), { recursive: true });
  fs.mkdirSync(sourceServerDir, { recursive: true });
  fs.mkdirSync(standaloneServerDir, { recursive: true });
  fs.writeFileSync(path.join(sourceBuildDir, 'BUILD_ID'), 'build-123');
  fs.writeFileSync(path.join(standaloneBuildDir, 'BUILD_ID'), 'build-123');
  fs.writeFileSync(path.join(runtimeDir, 'server.js'), 'console.log("frontend");');
  fs.writeFileSync(path.join(sourceBuildDir, 'static', 'main.js'), 'console.log("asset");');
  fs.writeFileSync(path.join(sourceServerDir, 'page_client-reference-manifest.js'), 'manifest');
  fs.writeFileSync(path.join(standaloneServerDir, 'page_client-reference-manifest.js'), 'manifest');
}

function createMockRootStandaloneBuild(frontendDir: string) {
  const sourceBuildDir = path.join(frontendDir, '.next');
  const runtimeDir = path.join(sourceBuildDir, 'standalone');
  const standaloneBuildDir = path.join(runtimeDir, '.next');
  const sourceServerDir = path.join(sourceBuildDir, 'server', 'app', 'login');
  const standaloneServerDir = path.join(standaloneBuildDir, 'server', 'app', 'login');

  fs.mkdirSync(standaloneBuildDir, { recursive: true });
  fs.mkdirSync(path.join(sourceBuildDir, 'static'), { recursive: true });
  fs.mkdirSync(sourceServerDir, { recursive: true });
  fs.mkdirSync(standaloneServerDir, { recursive: true });
  fs.writeFileSync(path.join(sourceBuildDir, 'BUILD_ID'), 'build-root');
  fs.writeFileSync(path.join(standaloneBuildDir, 'BUILD_ID'), 'build-root');
  fs.writeFileSync(path.join(runtimeDir, 'server.js'), 'console.log("frontend-root");');
  fs.writeFileSync(path.join(sourceBuildDir, 'static', 'main.js'), 'console.log("asset-root");');
  fs.writeFileSync(path.join(sourceServerDir, 'page_client-reference-manifest.js'), 'manifest-root');
  fs.writeFileSync(path.join(standaloneServerDir, 'page_client-reference-manifest.js'), 'manifest-root');
}

function createMockReleaseNestedStandaloneBuild(frontendDir: string, relativeAppDir: string) {
  const sourceBuildDir = path.join(frontendDir, '.next');
  const runtimeDir = path.join(sourceBuildDir, 'standalone', relativeAppDir);
  const standaloneBuildDir = path.join(runtimeDir, '.next');
  const sourceServerDir = path.join(sourceBuildDir, 'server', 'app', 'login');
  const standaloneServerDir = path.join(standaloneBuildDir, 'server', 'app', 'login');

  fs.mkdirSync(standaloneBuildDir, { recursive: true });
  fs.mkdirSync(path.join(sourceBuildDir, 'static'), { recursive: true });
  fs.mkdirSync(sourceServerDir, { recursive: true });
  fs.mkdirSync(standaloneServerDir, { recursive: true });
  fs.writeFileSync(path.join(sourceBuildDir, 'BUILD_ID'), 'build-release-nested');
  fs.writeFileSync(path.join(sourceBuildDir, 'required-server-files.json'), JSON.stringify({ relativeAppDir }, null, 2));
  fs.writeFileSync(path.join(standaloneBuildDir, 'BUILD_ID'), 'build-release-nested');
  fs.writeFileSync(path.join(runtimeDir, 'server.js'), 'console.log("frontend-release-nested");');
  fs.writeFileSync(path.join(sourceBuildDir, 'static', 'main.js'), 'console.log("asset-release-nested");');
  fs.writeFileSync(path.join(sourceServerDir, 'page_client-reference-manifest.js'), 'manifest-release-nested');
  fs.writeFileSync(path.join(standaloneServerDir, 'page_client-reference-manifest.js'), 'manifest-release-nested');
}

describe('NativeUpdateRuntimeAdapter', () => {
  let tmpDir: string;
  let sourceDir: string;
  let runtime: UpdateRuntimePaths;
  let metadata: Record<string, unknown>;
  let pm2JlistOutput: string;
  let pm2JlistOutputs: string[];
  let failFrontendRestart: boolean;
  let frontendRestartFailureName: string | null;
  let buildDependenciesInstalled: boolean;
  let frontendBuildLayout: 'monorepo' | 'root' | 'release-nested';
  let defaultBackendName: string;
  let defaultFrontendName: string;
  let runtimeSystemVersionPayload: Record<string, unknown>;
  let runtimeUpdateStatusPayload: Record<string, unknown>;

  const commandRunnerMock = {
    run: jest.fn(async (request: any) => {
      const args = Array.isArray(request.args) ? request.args : [];
      const cwd = String(request.cwd || '');
      const joinedArgs = args.join(' ');

      if (request.command === 'pnpm' && joinedArgs.includes('install --frozen-lockfile')) {
        buildDependenciesInstalled = joinedArgs.includes('--prod=false');
      }

      if (request.command === 'pm2' && joinedArgs === 'jlist') {
        const nextJlistOutput = pm2JlistOutputs.length > 0 ? pm2JlistOutputs.shift() : null;
        return {
          commandRunId: 'cmd-pm2-jlist',
          exitCode: 0,
          stdout: nextJlistOutput ?? pm2JlistOutput,
          stderr: '',
          stdoutPath: null,
          stderrPath: null,
        };
      }

      if (
        request.command === 'pm2' &&
        Array.isArray(request.args) &&
        request.args.includes('--name') &&
        failFrontendRestart
      ) {
        const processName = String(request.args[request.args.indexOf('--name') + 1] || '');
        if (processName !== (frontendRestartFailureName || defaultFrontendName)) {
          return {
            commandRunId: `cmd-${request.step}`,
            exitCode: 0,
            stdout: 'ok',
            stderr: '',
            stdoutPath: null,
            stderrPath: null,
          };
        }
        return {
          commandRunId: 'cmd-pm2-frontend-fail',
          exitCode: 1,
          stdout: '',
          stderr: 'frontend restart failed',
          stdoutPath: null,
          stderrPath: null,
        };
      }

      if (request.command === 'pnpm' && joinedArgs.includes('--filter frontend build')) {
        const frontendDir = path.join(cwd, 'apps', 'frontend');
        if (frontendBuildLayout === 'root') {
          createMockRootStandaloneBuild(frontendDir);
        } else if (frontendBuildLayout === 'release-nested') {
          createMockReleaseNestedStandaloneBuild(frontendDir, path.join('releases', 'v1.2.3', 'apps', 'frontend'));
        } else {
          createMockFrontendStandaloneBuild(frontendDir);
        }
      }

      if (request.command === 'pnpm' && joinedArgs.includes('--filter backend build')) {
        if (!buildDependenciesInstalled) {
          return {
            commandRunId: 'cmd-build-backend-fail',
            exitCode: 1,
            stdout: '',
            stderr: 'sh: 1: nest: not found',
            stdoutPath: null,
            stderrPath: null,
          };
        }

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

      if (url.includes('/api/system/version')) {
        return JSON.stringify(runtimeSystemVersionPayload);
      }

      if (url.includes('/api/update/status')) {
        return JSON.stringify(runtimeUpdateStatusPayload);
      }

      if (url.includes('/clear-cache.html')) {
        return '<html>clear-cache</html>';
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
    pm2JlistOutputs = [];
    failFrontendRestart = false;
    frontendRestartFailureName = null;
    buildDependenciesInstalled = false;
    frontendBuildLayout = 'monorepo';
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluggor-native-adapter-'));
    defaultBackendName = `${path.basename(tmpDir)}-backend`;
    defaultFrontendName = `${path.basename(tmpDir)}-frontend`;
    pm2JlistOutput = JSON.stringify([
      {
        name: defaultBackendName,
        pm2_env: {
          status: 'online',
          pm_id: 0,
          pm_cwd: path.join(tmpDir, 'releases', 'v1.2.3', 'apps', 'backend'),
          pm_exec_path: path.join(tmpDir, 'releases', 'v1.2.3', 'apps', 'backend', 'dist', 'main.js'),
          env: {
            PORT: '4000',
          },
        },
      },
      {
        name: defaultFrontendName,
        pm2_env: {
          status: 'online',
          pm_id: 1,
          pm_cwd: path.join(tmpDir, 'releases', 'v1.2.3', 'apps', 'frontend'),
          pm_exec_path: path.join(tmpDir, 'releases', 'v1.2.3', 'apps', 'frontend', 'scripts', 'start-standalone.mjs'),
          env: {
            PORT: '5000',
          },
        },
      },
    ]);
    runtimeSystemVersionPayload = {
      version: 'v1.2.3',
      installedVersionRaw: 'v1.2.3',
      installedBaseTag: 'v1.2.3',
      installedVersionNormalized: '1.2.3',
      isExactTaggedRelease: true,
      versionSource: 'git_exact_tag',
    };
    runtimeUpdateStatusPayload = {
      currentVersion: 'v1.2.3',
      installedVersionRaw: 'v1.2.3',
      installedBaseTag: 'v1.2.3',
      installedVersionNormalized: '1.2.3',
      updateAvailable: false,
      availableVersion: null,
    };
    sourceDir = path.join(tmpDir, 'source');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(sourceDir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
    fs.writeFileSync(path.join(sourceDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    fs.mkdirSync(path.join(sourceDir, 'apps', 'backend'), { recursive: true });
    fs.mkdirSync(path.join(sourceDir, 'apps', 'backend', 'prisma'), { recursive: true });
    fs.mkdirSync(path.join(sourceDir, 'apps', 'frontend', 'public'), { recursive: true });
    fs.mkdirSync(path.join(sourceDir, 'apps', 'frontend', 'scripts'), { recursive: true });
    fs.writeFileSync(
      path.join(sourceDir, 'apps', 'backend', 'package.json'),
      JSON.stringify(
        {
          scripts: {
            'seed:deploy': 'tsx prisma/seed.ts deploy',
          },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(path.join(sourceDir, 'apps', 'backend', 'prisma', 'seed.ts'), 'console.log("seed");\n');
    fs.writeFileSync(path.join(sourceDir, 'apps', 'frontend', 'package.json'), '{}');
    fs.writeFileSync(path.join(sourceDir, 'apps', 'frontend', 'public', 'clear-cache.html'), '<html></html>');
    fs.writeFileSync(
      path.join(sourceDir, 'apps', 'frontend', 'scripts', 'start-standalone.mjs'),
      'console.log("start-standalone");\n',
    );

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
    expect(
      fs.existsSync(
        path.join(targetReleaseDir, 'apps', 'frontend', '.next', 'standalone', 'apps', 'frontend', 'server.js'),
      ),
    ).toBe(true);
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
    expect(result.result).toMatchObject({
      sourceType: 'local_source_path',
      releasePreparation: {
        action: 'created',
      },
    });
  });

  it('fetch_code reutiliza a release alvo quando ela ja existe com estrutura integra', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const existingReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    fs.mkdirSync(path.join(existingReleaseDir, 'apps', 'backend'), { recursive: true });
    fs.mkdirSync(path.join(existingReleaseDir, 'apps', 'frontend'), { recursive: true });
    fs.writeFileSync(path.join(existingReleaseDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(existingReleaseDir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n');
    fs.writeFileSync(path.join(existingReleaseDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    fs.writeFileSync(path.join(existingReleaseDir, 'apps', 'backend', 'package.json'), '{}');
    fs.writeFileSync(path.join(existingReleaseDir, 'apps', 'frontend', 'package.json'), '{}');
    fs.writeFileSync(path.join(existingReleaseDir, 'keep.txt'), 'preserve');

    const result = await adapter.executeStep('fetch_code', {
      execution,
      runtime,
      metadata,
    });

    expect(result.result).toMatchObject({
      sourceType: 'existing_release',
      releasePreparation: {
        action: 'reused',
      },
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'release_existente_reutilizada',
        }),
      ]),
    );
    expect(fs.existsSync(path.join(existingReleaseDir, 'keep.txt'))).toBe(true);
    expect(commandRunnerMock.recordInternalOperation).not.toHaveBeenCalled();
  });

  it('fetch_code reconstrui a release alvo quando encontra estrutura parcial de tentativa anterior', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const existingReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    fs.mkdirSync(path.join(existingReleaseDir, 'apps', 'backend'), { recursive: true });
    fs.writeFileSync(path.join(existingReleaseDir, 'apps', 'backend', 'package.json'), '{}');
    fs.writeFileSync(path.join(existingReleaseDir, 'stale.tmp'), 'stale');

    const result = await adapter.executeStep('fetch_code', {
      execution,
      runtime,
      metadata,
    });

    expect(result.result).toMatchObject({
      sourceType: 'local_source_path',
      releasePreparation: {
        action: 'recreated',
      },
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'release_existente_reconstruida',
        }),
      ]),
    );
    expect(fs.existsSync(path.join(existingReleaseDir, 'stale.tmp'))).toBe(false);
    expect(fs.existsSync(path.join(existingReleaseDir, 'package.json'))).toBe(true);
    expect(commandRunnerMock.recordInternalOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'fetch_code',
        metadata: expect.objectContaining({
          releasePreparationAction: 'recreated',
        }),
      }),
    );
  });

  it('fetch_code falha com erro estruturado quando nenhuma origem de release esta configurada', async () => {
    const adapter = createAdapter();
    const execution = createExecution();

    await expect(
      adapter.executeStep('fetch_code', {
        execution,
        runtime,
        metadata: {},
      }),
    ).rejects.toMatchObject({
      code: 'UPDATE_FETCH_CODE_SOURCE_NOT_CONFIGURED',
      category: 'UPDATE_FETCH_CODE_FAILED',
    });
  });

  it('install_dependencies native preserva devDependencies da release para o build local', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    fs.mkdirSync(targetReleaseDir, { recursive: true });

    await adapter.executeStep('install_dependencies', {
      execution,
      runtime,
      metadata: {
        targetReleaseDir,
      },
    });

    expect(commandRunnerMock.run).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'install_dependencies',
        command: 'pnpm',
        args: ['install', '--frozen-lockfile', '--prod=false'],
        cwd: targetReleaseDir,
      }),
    );
    expect(buildDependenciesInstalled).toBe(true);
  });

  it('build_frontend native fixa o distDir canonico e prepara o standalone esperado', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    fs.mkdirSync(path.join(targetReleaseDir, 'apps', 'frontend', 'public'), { recursive: true });
    fs.mkdirSync(path.join(targetReleaseDir, 'apps', 'frontend', 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(targetReleaseDir, 'apps', 'frontend', 'public', 'clear-cache.html'), '<html></html>');
    fs.writeFileSync(path.join(targetReleaseDir, 'apps', 'frontend', 'scripts', 'start-standalone.mjs'), 'console.log("start");');

    const result = await adapter.executeStep('build_frontend', {
      execution,
      runtime,
      metadata: {
        targetReleaseDir,
      },
    });

    expect(commandRunnerMock.run).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'build_frontend',
        command: 'pnpm',
        args: ['--filter', 'frontend', 'build'],
        cwd: targetReleaseDir,
        env: expect.objectContaining({
          NEXT_DIST_DIR: '.next',
          NODE_ENV: 'production',
          NEXT_PUBLIC_API_URL: '/api',
        }),
      }),
    );
    expect(result.metadata).toMatchObject({
      frontendEntryRelative: path.join('.next', 'standalone', 'apps', 'frontend', 'server.js'),
      frontendRuntimeDirRelative: path.join('.next', 'standalone', 'apps', 'frontend'),
      frontendBuildDirRelative: path.join('.next', 'standalone', 'apps', 'frontend', '.next'),
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'frontend_build_concluido' }),
        expect.objectContaining({ code: 'frontend_standalone_empacotado' }),
        expect.objectContaining({ code: 'frontend_standalone_validado' }),
      ]),
    );
  });

  it('build_frontend native encontra o standalone gerado pelo relativeAppDir da release', async () => {
    frontendBuildLayout = 'release-nested';
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    fs.mkdirSync(path.join(targetReleaseDir, 'apps', 'frontend', 'public'), { recursive: true });
    fs.mkdirSync(path.join(targetReleaseDir, 'apps', 'frontend', 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(targetReleaseDir, 'apps', 'frontend', 'public', 'clear-cache.html'), '<html></html>');
    fs.writeFileSync(path.join(targetReleaseDir, 'apps', 'frontend', 'scripts', 'start-standalone.mjs'), 'console.log("start");');

    const result = await adapter.executeStep('build_frontend', {
      execution,
      runtime,
      metadata: {
        targetReleaseDir,
      },
    });

    expect(result.result).toMatchObject({
      standaloneLayout: 'required-server-files',
    });
    expect(result.metadata).toMatchObject({
      frontendEntryRelative: path.join(
        '.next',
        'standalone',
        'releases',
        'v1.2.3',
        'apps',
        'frontend',
        'server.js',
      ),
    });
    expect(
      fs.existsSync(
        path.join(
          targetReleaseDir,
          'apps',
          'frontend',
          '.next',
          'standalone',
          'releases',
          'v1.2.3',
          'apps',
          'frontend',
          'server.js',
        ),
      ),
    ).toBe(true);
  });

  it('seed e resolvido pelo comando canonico do package.json no fluxo native', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    const backendDir = path.join(targetReleaseDir, 'apps', 'backend');
    fs.mkdirSync(path.join(backendDir, 'prisma'), { recursive: true });
    fs.writeFileSync(
      path.join(backendDir, 'package.json'),
      JSON.stringify(
        {
          scripts: {
            'seed:deploy': 'tsx prisma/seed.ts deploy',
          },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(path.join(backendDir, 'prisma', 'seed.ts'), 'console.log("seed");\n');

    const result = await adapter.executeStep('seed', {
      execution,
      runtime,
      metadata: {
        targetReleaseDir,
      },
    });

    expect(commandRunnerMock.run).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'seed',
        command: 'pnpm',
        args: ['run', 'seed:deploy'],
        cwd: backendDir,
      }),
    );
    expect(result.result).toMatchObject({
      commandSource: 'package_json_script',
      resolvedCommand: 'pnpm run seed:deploy',
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'seed_entrypoint_resolvido',
        }),
      ]),
    );
  });

  it('seed falha explicitamente quando a release nao possui entrypoint executavel', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    const backendDir = path.join(targetReleaseDir, 'apps', 'backend');
    fs.mkdirSync(backendDir, { recursive: true });
    fs.writeFileSync(path.join(backendDir, 'package.json'), '{}');

    await expect(
      adapter.executeStep('seed', {
        execution,
        runtime,
        metadata: {
          targetReleaseDir,
        },
      }),
    ).rejects.toMatchObject({
      code: 'UPDATE_SEED_ENTRYPOINT_NOT_FOUND',
    });
  });

  it('script legado segue o mesmo contrato canonico de seed do adapter native', () => {
    const scriptPath = path.resolve(process.cwd(), '..', '..', 'install', 'update-native.sh');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    expect(scriptContent).toContain('SEED_COMMAND_ARGS=(run seed:deploy)');
    expect(scriptContent).toContain('SEED_COMMAND_ARGS=(exec tsx prisma/seed.ts deploy)');
    expect(scriptContent).toContain('SEED_COMMAND_ARGS=(dist/prisma/seed.js deploy)');
    expect(scriptContent.indexOf('SEED_COMMAND_ARGS=(run seed:deploy)')).toBeLessThan(
      scriptContent.indexOf('SEED_COMMAND_ARGS=(dist/prisma/seed.js deploy)'),
    );
  });

  it('script legado trata retry da mesma release com reutilizacao ou reconstrucao estruturada', () => {
    const scriptPath = path.resolve(process.cwd(), '..', '..', 'install', 'update-native.sh');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    expect(scriptContent).toContain('RELEASE_PREPARATION_ACTION="reused"');
    expect(scriptContent).toContain('RELEASE_PREPARATION_ACTION="recreated"');
    expect(scriptContent).toContain('validate_release_dir "$release_dir"');
    expect(scriptContent).toContain('LAST_RELEASE_PREPARATION_ERROR=');
    expect(scriptContent).toContain('ensure_release_code "$TARGET_TAG" "$NEW_RELEASE_DIR" || fail_and_exit');
  });

  it('package_frontend_assets gera o artefato standalone esperado no layout real', async () => {
    const adapter = createAdapter();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    const frontendDir = path.join(targetReleaseDir, 'apps', 'frontend');
    fs.mkdirSync(path.join(frontendDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(frontendDir, 'public', 'clear-cache.html'), '<html></html>');
    createMockFrontendStandaloneBuild(frontendDir);

    const layout = await (adapter as any).resolveFrontendLayout(frontendDir);
    await (adapter as any).copyFrontendRuntimeAssets(frontendDir, layout);

    expect(
      fs.existsSync(path.join(frontendDir, '.next', 'standalone', 'apps', 'frontend', 'public', 'clear-cache.html')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(frontendDir, '.next', 'standalone', 'apps', 'frontend', '.next', 'static', 'main.js')),
    ).toBe(true);
  });

  it('package_frontend_assets encontra corretamente o layout root alternativo do standalone', async () => {
    const adapter = createAdapter();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    const frontendDir = path.join(targetReleaseDir, 'apps', 'frontend');
    fs.mkdirSync(path.join(frontendDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(frontendDir, 'public', 'clear-cache.html'), '<html></html>');
    createMockRootStandaloneBuild(frontendDir);

    const layout = await (adapter as any).resolveFrontendLayout(frontendDir);
    await (adapter as any).copyFrontendRuntimeAssets(frontendDir, layout);

    expect(layout).toMatchObject({
      label: 'root',
      entryRelativePath: path.join('.next', 'standalone', 'server.js'),
    });
    expect(
      fs.existsSync(path.join(frontendDir, '.next', 'standalone', 'public', 'clear-cache.html')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(frontendDir, '.next', 'standalone', '.next', 'static', 'main.js')),
    ).toBe(true);
  });

  it('validate_frontend_artifact aceita um artefato standalone valido do frontend', async () => {
    const adapter = createAdapter();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    const frontendDir = path.join(targetReleaseDir, 'apps', 'frontend');
    fs.mkdirSync(path.join(frontendDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(frontendDir, 'public', 'clear-cache.html'), '<html></html>');
    createMockFrontendStandaloneBuild(frontendDir);

    const layout = await (adapter as any).resolveFrontendLayout(frontendDir);
    await (adapter as any).copyFrontendRuntimeAssets(frontendDir, layout);

    await expect((adapter as any).validateFrontendArtifactLayout(frontendDir, layout)).resolves.toBeUndefined();
  });

  it('validate_frontend_artifact rejeita artefato invalido quando o static nao foi empacotado', async () => {
    const adapter = createAdapter();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    const frontendDir = path.join(targetReleaseDir, 'apps', 'frontend');
    createMockFrontendStandaloneBuild(frontendDir);

    const layout = await (adapter as any).resolveFrontendLayout(frontendDir);

    await expect((adapter as any).validateFrontendArtifactLayout(frontendDir, layout)).rejects.toThrow(
      'Diretorio .next/static nao foi copiado para o standalone do frontend.',
    );
  });

  it('validate_frontend_artifact falha quando o standalone nao existe', async () => {
    const adapter = createAdapter();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    const frontendDir = path.join(targetReleaseDir, 'apps', 'frontend');
    fs.mkdirSync(path.join(frontendDir, '.next'), { recursive: true });
    fs.writeFileSync(path.join(frontendDir, '.next', 'BUILD_ID'), 'build-sem-standalone');

    await expect(
      (adapter as any).validateFrontendArtifactLayout(frontendDir, {
        entryRelativePath: path.join('.next', 'standalone', 'apps', 'frontend', 'server.js'),
        runtimeDirRelativePath: path.join('.next', 'standalone', 'apps', 'frontend'),
        buildDirRelativePath: path.join('.next', 'standalone', 'apps', 'frontend', '.next'),
      }),
    ).rejects.toThrow(
      `Artefato frontend incompleto: ${path.join(
        frontendDir,
        '.next',
        'standalone',
        'apps',
        'frontend',
        'server.js',
      )}`,
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

  it('switch_release falha antes da confirmacao quando o ponteiro observado diverge', async () => {
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

  it('restart_services native retorna servicos reiniciados com evidencia estrutural', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    fs.mkdirSync(path.join(targetReleaseDir, 'apps', 'backend', 'dist'), { recursive: true });
    fs.mkdirSync(path.join(targetReleaseDir, 'apps', 'frontend', 'scripts'), { recursive: true });
    fs.writeFileSync(
      path.join(targetReleaseDir, 'apps', 'frontend', 'scripts', 'start-standalone.mjs'),
      'console.log("frontend");',
    );
    createMockFrontendStandaloneBuild(path.join(targetReleaseDir, 'apps', 'frontend'));

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
    const frontendRestartCall = commandRunnerMock.run.mock.calls
      .map(([request]) => request)
      .find(
        (request) =>
          request.step === 'restart_services' &&
          request.command === 'pm2' &&
          Array.isArray(request.args) &&
          request.args.includes('--name') &&
          request.args.includes(defaultFrontendName),
      );

    expect(frontendRestartCall).toEqual(
      expect.objectContaining({
        env: expect.objectContaining({
          NEXT_PUBLIC_API_URL: '/api',
          NODE_ENV: 'production',
        }),
        metadata: expect.objectContaining({
          launcher: 'start_standalone_script',
        }),
      }),
    );
    expect(String(frontendRestartCall?.args?.[1] || '')).toContain(
      ['node', path.join('scripts', 'start-standalone.mjs')].join(' '),
    );
  });

  it('restart_services native falha de forma parcial quando um servico nao sobe', async () => {
    failFrontendRestart = true;
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    fs.mkdirSync(path.join(targetReleaseDir, 'apps', 'backend', 'dist'), { recursive: true });
    fs.mkdirSync(path.join(targetReleaseDir, 'apps', 'frontend', 'scripts'), { recursive: true });
    fs.writeFileSync(
      path.join(targetReleaseDir, 'apps', 'frontend', 'scripts', 'start-standalone.mjs'),
      'console.log("frontend");',
    );
    createMockFrontendStandaloneBuild(path.join(targetReleaseDir, 'apps', 'frontend'));

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

  it('restart_services remove aliases legados do PM2 e mantem apenas a nova release ativa', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    const backendDir = path.join(targetReleaseDir, 'apps', 'backend');
    const frontendDir = path.join(targetReleaseDir, 'apps', 'frontend');
    const pm2BackendName = 'gpluggor-backend';
    const pm2FrontendName = 'gpluggor-frontend';
    fs.mkdirSync(path.join(backendDir, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(frontendDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(frontendDir, 'scripts', 'start-standalone.mjs'), 'console.log("frontend");');
    createMockFrontendStandaloneBuild(frontendDir);

    pm2JlistOutputs = [
      JSON.stringify([
        {
          name: pm2BackendName,
          pm2_env: {
            status: 'online',
            pm_id: 0,
            pm_cwd: path.join(runtime.releasesDir, 'legacy-release', 'apps', 'backend'),
            pm_exec_path: path.join(runtime.releasesDir, 'legacy-release', 'apps', 'backend', 'dist', 'main.js'),
          },
        },
        {
          name: pm2FrontendName,
          pm2_env: {
            status: 'online',
            pm_id: 1,
            pm_cwd: path.join(runtime.releasesDir, 'legacy-release', 'apps', 'frontend'),
            pm_exec_path: path.join(
              runtime.releasesDir,
              'legacy-release',
              'apps',
              'frontend',
              'scripts',
              'start-standalone.mjs',
            ),
          },
        },
        {
          name: 'multitenant-backend',
          pm2_env: {
            status: 'online',
            pm_id: 2,
            pm_cwd: path.join(runtime.releasesDir, 'legacy-release', 'apps', 'backend'),
            pm_exec_path: path.join(runtime.releasesDir, 'legacy-release', 'apps', 'backend', 'dist', 'main.js'),
          },
        },
        {
          name: 'multitenant-frontend',
          pm2_env: {
            status: 'online',
            pm_id: 3,
            pm_cwd: path.join(runtime.releasesDir, 'legacy-release', 'apps', 'frontend'),
            pm_exec_path: path.join(
              runtime.releasesDir,
              'legacy-release',
              'apps',
              'frontend',
              'scripts',
              'start-standalone.mjs',
            ),
          },
        },
      ]),
      JSON.stringify([
        {
          name: pm2BackendName,
          pm2_env: {
            status: 'online',
            pm_id: 4,
            pm_cwd: backendDir,
            pm_exec_path: path.join(backendDir, 'dist', 'main.js'),
            env: {
              PORT: '4000',
            },
          },
        },
        {
          name: pm2FrontendName,
          pm2_env: {
            status: 'online',
            pm_id: 5,
            pm_cwd: frontendDir,
            pm_exec_path: path.join(frontendDir, 'scripts', 'start-standalone.mjs'),
            env: {
              PORT: '5000',
            },
          },
        },
      ]),
    ];

    const result = await adapter.executeStep('restart_services', {
      execution,
      runtime,
      metadata: {
        targetReleaseDir,
        pm2BackendName,
        pm2FrontendName,
      },
    });

    const deleteCalls = commandRunnerMock.run.mock.calls
      .map(([request]) => request)
      .filter((request) => request.command === 'pm2' && Array.isArray(request.args) && request.args[0] === 'delete');

    expect(deleteCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ args: ['delete', pm2BackendName] }),
        expect.objectContaining({ args: ['delete', pm2FrontendName] }),
        expect.objectContaining({ args: ['delete', 'multitenant-backend'] }),
        expect.objectContaining({ args: ['delete', 'multitenant-frontend'] }),
      ]),
    );
    expect(result.result).toMatchObject({
      pm2BackendName,
      pm2FrontendName,
      purgedConflictingProcesses: expect.arrayContaining(['multitenant-backend', 'multitenant-frontend']),
      pm2Status: expect.objectContaining({
        backend: expect.objectContaining({
          processName: pm2BackendName,
          pointsToExpectedRelease: true,
        }),
        frontend: expect.objectContaining({
          processName: pm2FrontendName,
          pointsToExpectedRelease: true,
        }),
        backendConflicts: [],
        frontendConflicts: [],
      }),
    });
  });

  it('pre_swap_smoke_test sobe o frontend pelo launcher standalone esperado', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    const frontendDir = path.join(targetReleaseDir, 'apps', 'frontend');
    fs.mkdirSync(path.join(frontendDir, 'public'), { recursive: true });
    fs.mkdirSync(path.join(frontendDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(frontendDir, 'public', 'clear-cache.html'), '<html></html>');
    fs.writeFileSync(path.join(frontendDir, 'scripts', 'start-standalone.mjs'), 'console.log("start");');
    createMockFrontendStandaloneBuild(frontendDir);

    const result = await adapter.executeStep('pre_switch_validation', {
      execution,
      runtime,
      metadata: {
        targetReleaseDir,
      },
    });

    expect(result.result).toMatchObject({
      smokeFrontendPort: 5100,
      launcher: 'start_standalone_script',
      startCommand: ['node', path.join('scripts', 'start-standalone.mjs')].join(' '),
    });
    expect(commandRunnerMock.startBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'pre_switch_validation',
        command: 'node',
        args: [path.join('scripts', 'start-standalone.mjs')],
        cwd: frontendDir,
        env: expect.objectContaining({
          NEXT_PUBLIC_API_URL: '/api',
          PORT: '5100',
          HOSTNAME: '127.0.0.1',
          NODE_ENV: 'production',
        }),
        metadata: expect.objectContaining({
          smokeTest: true,
          launcher: 'start_standalone_script',
        }),
      }),
    );
  });

  it('healthcheck native valida PM2, release ativa e versao observada', async () => {
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

  it('healthcheck native falha de forma estruturada quando os processos nao ficam online', async () => {
    pm2JlistOutput = JSON.stringify([
      {
        name: defaultBackendName,
        pm2_env: {
          status: 'errored',
          pm_id: 0,
          pm_cwd: path.join(tmpDir, 'releases', 'v1.2.3', 'apps', 'backend'),
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

  it('post_validation nao conclui sucesso quando o runtime ainda serve a versao antiga', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const targetReleaseDir = path.join(runtime.releasesDir, 'v1.2.3');
    const backendDir = path.join(targetReleaseDir, 'apps', 'backend');
    const frontendDir = path.join(targetReleaseDir, 'apps', 'frontend');
    fs.mkdirSync(path.join(backendDir, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(frontendDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(frontendDir, 'scripts', 'start-standalone.mjs'), 'console.log("frontend");');
    createMockFrontendStandaloneBuild(frontendDir);
    runtimeSystemVersionPayload = {
      version: 'v1.0.0',
      installedVersionRaw: 'v1.0.0',
      installedBaseTag: 'v1.0.0',
      installedVersionNormalized: '1.0.0',
      isExactTaggedRelease: true,
      versionSource: 'git_exact_tag',
    };
    runtimeUpdateStatusPayload = {
      currentVersion: 'v1.0.0',
      installedVersionRaw: 'v1.0.0',
      installedBaseTag: 'v1.0.0',
      installedVersionNormalized: '1.0.0',
      updateAvailable: true,
      availableVersion: 'v1.2.3',
    };

    await expect(
      adapter.executeStep('post_validation', {
        execution,
        runtime,
        metadata: {
          targetReleaseDir,
        },
      }),
    ).rejects.toMatchObject({
      code: 'UPDATE_POST_DEPLOY_RUNTIME_VERSION_MISMATCH',
    });
  });

  it('script legado remove aliases PM2 conflitantes e valida a release ativa publicada', () => {
    const scriptPath = path.resolve(process.cwd(), '..', '..', 'install', 'update-native.sh');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    expect(scriptContent).toContain('collect_conflicting_pm2_names');
    expect(scriptContent).toContain('assert_pm2_release_state');
    expect(scriptContent).toContain('/api/system/version');
    expect(scriptContent).toContain('/api/update/status');
  });
});
