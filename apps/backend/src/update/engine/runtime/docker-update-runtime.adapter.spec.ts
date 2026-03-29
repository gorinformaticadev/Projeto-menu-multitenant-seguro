import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DockerUpdateRuntimeAdapter } from './docker-update-runtime.adapter';
import type { UpdateExecutionRecord } from '../update-execution.types';
import type { UpdateRuntimePaths } from './update-runtime-adapter.interface';

function createExecution(): UpdateExecutionRecord {
  return {
    id: 'execution-docker-1',
    installationId: 'host-1',
    requestedBy: 'super-1',
    source: 'panel',
    mode: 'docker',
    currentVersion: 'v1.0.0',
    targetVersion: 'v1.2.3',
    status: 'running',
    currentStep: 'pull_images',
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

describe('DockerUpdateRuntimeAdapter', () => {
  let tmpDir: string;
  let runtime: UpdateRuntimePaths;
  let metadata: Record<string, unknown>;

  const commandRunnerMock = {
    run: jest.fn(async (request: any) => {
      const args = Array.isArray(request.args) ? request.args.join(' ') : '';

      if (args.includes('config --services')) {
        return {
          commandRunId: 'cmd-services',
          exitCode: 0,
          stdout: 'frontend\nbackend\nmigrate\n',
          stderr: '',
          stdoutPath: null,
          stderrPath: null,
        };
      }

      if (args.includes('config') && !args.includes('--services')) {
        return {
          commandRunId: 'cmd-config',
          exitCode: 0,
          stdout: [
            'services:',
            '  frontend:',
            '    image: ghcr.io/test/frontend:v1.2.3',
            '  backend:',
            '    image: ghcr.io/test/backend:v1.2.3',
          ].join('\n'),
          stderr: '',
          stdoutPath: null,
          stderrPath: null,
        };
      }

      if (args.includes('ps -q frontend')) {
        return {
          commandRunId: 'cmd-ps-frontend',
          exitCode: 0,
          stdout: 'frontend-container\n',
          stderr: '',
          stdoutPath: null,
          stderrPath: null,
        };
      }

      if (args.includes('ps -q backend')) {
        return {
          commandRunId: 'cmd-ps-backend',
          exitCode: 0,
          stdout: 'backend-container\n',
          stderr: '',
          stdoutPath: null,
          stderrPath: null,
        };
      }

      if (args.includes('{{.Image}}')) {
        return {
          commandRunId: 'cmd-image',
          exitCode: 0,
          stdout: 'sha256:current-image\n',
          stderr: '',
          stdoutPath: null,
          stderrPath: null,
        };
      }

      if (args.includes('{{.Config.Image}}')) {
        return {
          commandRunId: 'cmd-config-image',
          exitCode: 0,
          stdout: args.includes('frontend-container')
            ? 'ghcr.io/test/frontend:v1.0.0\n'
            : 'ghcr.io/test/backend:v1.0.0\n',
          stderr: '',
          stdoutPath: null,
          stderrPath: null,
        };
      }

      if (args.includes('{{if .State.Health}}')) {
        return {
          commandRunId: 'cmd-health',
          exitCode: 0,
          stdout: 'healthy\n',
          stderr: '',
          stdoutPath: null,
          stderrPath: null,
        };
      }

      return {
        commandRunId: 'cmd-generic',
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
        stdoutPath: null,
        stderrPath: null,
      };
    }),
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
    new DockerUpdateRuntimeAdapter(commandRunnerMock as any, probeServiceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluggor-docker-adapter-'));
    fs.mkdirSync(path.join(tmpDir, 'shared'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'install'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'install', '.env.production'), 'IMAGE_TAG=v1.2.3\n');
    fs.writeFileSync(
      path.join(tmpDir, 'docker-compose.prod.yml'),
      [
        'services:',
        '  frontend:',
        '    image: ghcr.io/test/frontend:v1.2.3',
        '  backend:',
        '    image: ghcr.io/test/backend:v1.2.3',
      ].join('\n'),
    );

    runtime = {
      baseDir: tmpDir,
      sharedDir: path.join(tmpDir, 'shared'),
      releasesDir: path.join(tmpDir, 'releases'),
      currentDir: path.join(tmpDir, 'current'),
      previousDir: path.join(tmpDir, 'previous'),
      logsDir: path.join(tmpDir, 'shared', 'logs', 'update-engine', 'execution-docker-1'),
      updateScriptPath: path.join(tmpDir, 'install', 'update-images.sh'),
      rollbackScriptPath: path.join(tmpDir, 'install', 'rollback-native.sh'),
      mode: 'docker',
      detectedMode: 'docker',
    };

    metadata = {
      composeFile: 'docker-compose.prod.yml',
      envFile: 'install/.env.production',
    };
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('executa todas as etapas do pipeline docker com sucesso', async () => {
    const adapter = createAdapter();
    const execution = createExecution();
    const steps = [
      'pull_images',
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

    expect(String(metadata.activeComposeOverride)).toContain('execution-docker-1-target.override.yml');
    expect(fs.existsSync(String(metadata.activeComposeOverride))).toBe(true);
    expect(probeServiceMock.waitForReady).toHaveBeenCalled();
    expect(commandRunnerMock.run).toHaveBeenCalled();
  });
});
