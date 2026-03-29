import { Injectable } from '@nestjs/common';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { UpdateCommandRunnerService } from '../update-command-runner.service';
import { UpdateHttpProbeService } from '../update-http-probe.service';
import {
  getExecutionPlanForMode,
  type UpdateExecutionErrorSnapshot,
  type UpdateExecutionMetadata,
  type UpdateStepCode,
} from '../update-execution.types';
import {
  UpdateRuntimeStepError,
  type UpdateRollbackExecutionResult,
  type UpdateRuntimeAdapter,
  type UpdateRuntimeAdapterDescriptor,
  type UpdateRuntimeExecutionStrategy,
  type UpdateStepExecutionContext,
  type UpdateStepExecutionResult,
} from './update-runtime-adapter.interface';

type NativePm2ProcessEvidence = {
  processName: string;
  found: boolean;
  status: string;
  pid: number;
  online: boolean;
};

type NativePm2StatusEvidence = {
  backend: NativePm2ProcessEvidence;
  frontend: NativePm2ProcessEvidence;
};

@Injectable()
export class NativeUpdateRuntimeAdapter implements UpdateRuntimeAdapter {
  readonly mode = 'native' as const;

  constructor(
    private readonly commandRunner: UpdateCommandRunnerService,
    private readonly probeService: UpdateHttpProbeService,
  ) {}

  describe(): UpdateRuntimeAdapterDescriptor {
    return {
      mode: this.mode,
      executionStrategy: this.resolveExecutionStrategy(),
      supportsRollback: true,
      restartStrategy: 'pm2_reload_or_start',
      healthcheckStrategy: 'http_and_runtime_probes',
      plannedSteps: getExecutionPlanForMode(this.mode),
    };
  }

  async executeStep(
    step: UpdateStepCode,
    context: UpdateStepExecutionContext,
  ): Promise<UpdateStepExecutionResult> {
    switch (step) {
      case 'fetch_code':
        return await this.fetchCode(context);
      case 'install_dependencies':
        return await this.installDependencies(context);
      case 'build_backend':
        return await this.buildBackend(context);
      case 'build_frontend':
        return await this.buildFrontend(context);
      case 'migrate':
        return await this.migrate(context);
      case 'seed':
        return await this.seed(context);
      case 'pre_switch_validation':
        return await this.preSwitchValidation(context);
      case 'switch_release':
        return await this.switchRelease(context);
      case 'restart_services':
        return await this.restartServices(context);
      case 'healthcheck':
        return await this.healthcheck(context);
      case 'post_validation':
        return await this.postValidation(context);
      case 'cleanup':
        return await this.cleanup(context);
      default:
        throw new Error(`Etapa ${step} nao suportada pelo adapter native.`);
    }
  }

  async executeRollback(
    context: UpdateStepExecutionContext,
    error: UpdateExecutionErrorSnapshot,
  ): Promise<UpdateRollbackExecutionResult> {
    const metadata = context.metadata;
    const previousReleaseRef = this.getMetadataString(metadata, 'previousReleaseRef');
    if (!previousReleaseRef || !(await this.pathExists(previousReleaseRef))) {
      throw new Error('Rollback native indisponivel: previousReleaseRef nao capturado ou inexistente.');
    }

    const currentReleaseRef =
      this.getMetadataString(metadata, 'currentReleaseRef') || (await this.safeRealpath(context.runtime.currentDir));

    await this.createDirSymlink(previousReleaseRef, context.runtime.currentDir);
    if (currentReleaseRef && currentReleaseRef !== previousReleaseRef) {
      await this.createDirSymlink(currentReleaseRef, context.runtime.previousDir);
    }

    const restartResult = await this.restartPm2(previousReleaseRef, context);
    const healthResult = await this.performLiveValidation(previousReleaseRef, context, true);

    return {
      result: {
        restoredReleaseRef: previousReleaseRef,
        previousReleaseRef: currentReleaseRef,
        restart: restartResult,
        healthcheck: healthResult,
        rollbackErrorCode: error.code,
      },
      metadata: {
        currentReleaseRef: previousReleaseRef,
        previousReleaseRef: currentReleaseRef || null,
        lastRollbackAt: new Date().toISOString(),
      },
    };
  }

  private async fetchCode(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const releaseDir = path.join(
      context.runtime.releasesDir,
      this.sanitizeReleaseName(context.execution.targetVersion),
    );
    await this.prepareTargetReleaseDir(releaseDir, context.runtime);

    const localSourcePath =
      this.getMetadataString(context.metadata, 'localSourcePath') ||
      String(process.env.UPDATE_LOCAL_SOURCE_PATH || '').trim();
    const gitRepoUrl =
      this.getMetadataString(context.metadata, 'gitRepoUrl') ||
      String(process.env.GIT_REPO_URL || '').trim();
    const gitAuthHeader =
      this.getMetadataString(context.metadata, 'gitAuthHeader') ||
      String(process.env.GIT_AUTH_HEADER || '').trim();

    if (localSourcePath) {
      await this.copySourceTree(localSourcePath, releaseDir);
      await this.commandRunner.recordInternalOperation({
        executionId: context.execution.id,
        step: 'fetch_code',
        command: 'internal:copy_source_tree',
        args: [localSourcePath, releaseDir],
        cwd: context.runtime.baseDir,
        logDir: context.runtime.logsDir,
        metadata: {
          source: 'local_source_path',
        },
      });
    } else if (gitRepoUrl) {
      const args = gitAuthHeader
        ? ['-c', gitAuthHeader, 'clone', '--depth', '1', '--branch', context.execution.targetVersion, gitRepoUrl, releaseDir]
        : ['clone', '--depth', '1', '--branch', context.execution.targetVersion, gitRepoUrl, releaseDir];
      await this.runCommandOrThrow(context, 'fetch_code', 'git', args, context.runtime.baseDir);
    } else {
      throw new Error('Nenhuma origem de release configurada para fetch_code (localSourcePath/gitRepoUrl).');
    }

    await this.linkSharedIntoRelease(releaseDir, context.runtime);
    await this.resetReleaseBuildOutputs(releaseDir);
    await this.assertRequiredReleaseFiles(releaseDir);

    return {
      result: {
        releaseDir,
        sourceType: localSourcePath ? 'local_source_path' : 'git_clone',
        resolvedVersion: context.execution.targetVersion,
      },
      metadata: {
        targetReleaseDir: releaseDir,
        targetReleaseResolvedVersion: context.execution.targetVersion,
      },
      evidence: [
        {
          code: 'release_preparada',
          summary: 'A release alvo foi materializada no diretório de releases.',
          details: {
            releaseDir,
            sourceType: localSourcePath ? 'local_source_path' : 'git_clone',
          },
        },
        {
          code: 'manifestos_detectados',
          summary: 'Os manifestos mínimos do backend e frontend foram encontrados.',
          details: {
            backendPackageJson: path.join(releaseDir, 'apps', 'backend', 'package.json'),
            frontendPackageJson: path.join(releaseDir, 'apps', 'frontend', 'package.json'),
          },
        },
      ],
    };
  }

  private async installDependencies(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const releaseDir = this.requireTargetReleaseDir(context.metadata);
    await this.runCommandOrThrow(
      context,
      'install_dependencies',
      'pnpm',
      ['install', '--frozen-lockfile', '--prod=false'],
      releaseDir,
    );

    return {
      result: {
        releaseDir,
      },
    };
  }

  private async buildBackend(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const releaseDir = this.requireTargetReleaseDir(context.metadata);
    await this.runCommandOrThrow(
      context,
      'build_backend',
      'pnpm',
      ['--filter', 'backend', 'exec', 'prisma', 'generate'],
      releaseDir,
    );
    await this.runCommandOrThrow(
      context,
      'build_backend',
      'pnpm',
      ['--filter', 'backend', 'build'],
      releaseDir,
    );

    return {
      result: {
        backendDir: path.join(releaseDir, 'apps', 'backend'),
      },
    };
  }

  private async buildFrontend(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const releaseDir = this.requireTargetReleaseDir(context.metadata);
    await this.runCommandOrThrow(
      context,
      'build_frontend',
      'pnpm',
      ['--filter', 'frontend', 'build'],
      releaseDir,
      await this.buildFrontendCommandEnv(releaseDir, context.runtime, {
        NEXT_DIST_DIR: '.next',
        NODE_ENV: 'production',
      }),
    );

    const frontendDir = path.join(releaseDir, 'apps', 'frontend');
    const layout = await this.resolveFrontendLayout(frontendDir);
    await this.copyFrontendRuntimeAssets(frontendDir, layout);
    await this.validateFrontendArtifactLayout(frontendDir, layout);

    return {
      result: {
        frontendDir,
        standaloneLayout: layout.label,
      },
      metadata: {
        frontendEntryRelative: layout.entryRelativePath,
        frontendRuntimeDirRelative: layout.runtimeDirRelativePath,
        frontendBuildDirRelative: layout.buildDirRelativePath,
      },
      evidence: [
        {
          code: 'frontend_build_concluido',
          summary: 'O frontend foi compilado com o distDir canonico da release native.',
          details: {
            frontendDir,
            distDir: '.next',
          },
        },
        {
          code: 'frontend_standalone_empacotado',
          summary: 'Os assets de runtime do frontend foram copiados para o standalone.',
          details: {
            layout: layout.label,
            runtimeDirRelativePath: layout.runtimeDirRelativePath,
            buildDirRelativePath: layout.buildDirRelativePath,
          },
        },
        {
          code: 'frontend_standalone_validado',
          summary: 'O artefato standalone do frontend passou pela validacao estrutural.',
          details: {
            entryRelativePath: layout.entryRelativePath,
            runtimeDirRelativePath: layout.runtimeDirRelativePath,
            buildDirRelativePath: layout.buildDirRelativePath,
          },
        },
      ],
    };
  }

  private async migrate(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const backendDir = path.join(this.requireTargetReleaseDir(context.metadata), 'apps', 'backend');
    await this.runCommandOrThrow(
      context,
      'migrate',
      'pnpm',
      ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
      backendDir,
      await this.buildNativeCommandEnv(context.runtime),
    );

    return {
      result: {
        backendDir,
      },
    };
  }

  private async seed(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const backendDir = path.join(this.requireTargetReleaseDir(context.metadata), 'apps', 'backend');
    await this.runCommandOrThrow(
      context,
      'seed',
      'node',
      ['dist/prisma/seed.js', 'deploy'],
      backendDir,
      await this.buildNativeCommandEnv(context.runtime),
    );

    return {
      result: {
        backendDir,
      },
    };
  }

  private async preSwitchValidation(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const releaseDir = this.requireTargetReleaseDir(context.metadata);
    const smokeResult = await this.smokeTestRelease(releaseDir, context);

    return {
      result: smokeResult,
    };
  }

  private async switchRelease(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const releaseDir = this.requireTargetReleaseDir(context.metadata);
    const currentReleaseRef = await this.safeRealpath(context.runtime.currentDir);
    if (currentReleaseRef && currentReleaseRef !== releaseDir) {
      await this.createDirSymlink(currentReleaseRef, context.runtime.previousDir);
    }

    await this.writeBuildMetadataFiles(releaseDir, context);
    await this.createDirSymlink(releaseDir, context.runtime.currentDir);
    const observedCurrentReleaseRef = await this.safeRealpath(context.runtime.currentDir);
    const expectedCurrentReleaseRef = (await this.safeRealpath(releaseDir)) || releaseDir;
    if (!observedCurrentReleaseRef || !this.isSameResolvedPath(observedCurrentReleaseRef, expectedCurrentReleaseRef)) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_SWITCH_RELEASE_CONFIRMATION_FAILED',
        category: 'UPDATE_SWITCH_RELEASE_FAILED',
        stage: 'switch_release',
        userMessage: 'A troca da release nao foi confirmada no ponteiro current.',
        technicalMessage: `current aponta para ${observedCurrentReleaseRef || 'null'} em vez de ${expectedCurrentReleaseRef}.`,
        rollbackEligible: true,
        retryable: false,
        details: {
          releaseDir: expectedCurrentReleaseRef,
          observedCurrentReleaseRef,
          previousReleaseRef: currentReleaseRef,
        },
      });
    }

    return {
      result: {
        currentReleaseRef: releaseDir,
        previousReleaseRef: currentReleaseRef,
        observedCurrentReleaseRef,
      },
      metadata: {
        currentReleaseRef: releaseDir,
        previousReleaseRef: currentReleaseRef || null,
      },
      evidence: [
        {
          code: 'ponteiro_current_atualizado',
          summary: 'O ponteiro current foi trocado para a nova release.',
          details: {
            previousReleaseRef: currentReleaseRef,
            observedCurrentReleaseRef,
          },
        },
      ],
    };
  }

  private async restartServices(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const releaseDir = this.requireTargetReleaseDir(context.metadata);
    const restartResult = await this.restartPm2(releaseDir, context);
    return {
      result: restartResult,
      metadata: restartResult,
      evidence: [
        {
          code: 'servicos_pm2_reiniciados',
          summary: 'Os serviços do PM2 foram reiniciados e revalidados pelo adapter.',
          details: restartResult,
        },
      ],
      retryable: true,
    };
  }

  private async healthcheck(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const releaseDir = this.requireTargetReleaseDir(context.metadata);
    const result = await this.performHealthcheck(releaseDir, context);
    return {
      result,
      evidence: [
        {
          code: 'runtime_native_saudavel',
          summary: 'Processos PM2, endpoints HTTP e versão observada ficaram consistentes.',
          details: result,
        },
      ],
    };
  }

  private async postValidation(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const releaseDir = this.requireTargetReleaseDir(context.metadata);
    const result = await this.performLiveValidation(releaseDir, context, false);
    return {
      result,
    };
  }

  private async cleanup(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const releaseDir = this.requireTargetReleaseDir(context.metadata);
    const releasesToKeep = Number(process.env.RELEASES_TO_KEEP || 5);
    const currentTarget = await this.safeRealpath(context.runtime.currentDir);
    const previousTarget = await this.safeRealpath(context.runtime.previousDir);

    const entries = await fsp.readdir(context.runtime.releasesDir, { withFileTypes: true }).catch(() => []);
    const releasePaths = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const fullPath = path.join(context.runtime.releasesDir, entry.name);
          const stat = await fsp.stat(fullPath).catch(() => null);
          return {
            fullPath,
            mtimeMs: stat?.mtimeMs || 0,
          };
        }),
    );

    releasePaths.sort((a, b) => b.mtimeMs - a.mtimeMs);

    const removed: string[] = [];
    let kept = 0;
    for (const releasePath of releasePaths) {
      if (
        releasePath.fullPath === currentTarget ||
        releasePath.fullPath === previousTarget ||
        releasePath.fullPath === releaseDir
      ) {
        continue;
      }

      if (kept < releasesToKeep) {
        kept += 1;
        continue;
      }

      await fsp.rm(releasePath.fullPath, { recursive: true, force: true });
      removed.push(releasePath.fullPath);
    }

    return {
      result: {
        removedReleases: removed,
      },
    };
  }

  private resolveExecutionStrategy(): UpdateRuntimeExecutionStrategy {
    return process.env.UPDATE_NATIVE_EXECUTION_STRATEGY === 'legacy_bridge'
      ? 'legacy_bridge'
      : 'native_agent';
  }

  private requireTargetReleaseDir(metadata: UpdateExecutionMetadata): string {
    const releaseDir = this.getMetadataString(metadata, 'targetReleaseDir');
    if (!releaseDir) {
      throw new Error('targetReleaseDir nao definido na execucao.');
    }

    return releaseDir;
  }

  private async prepareTargetReleaseDir(
    releaseDir: string,
    runtime: UpdateStepExecutionContext['runtime'],
  ): Promise<void> {
    const currentTarget = await this.safeRealpath(runtime.currentDir);
    const previousTarget = await this.safeRealpath(runtime.previousDir);

    if (releaseDir === currentTarget || releaseDir === previousTarget) {
      throw new Error(`Release protegida por current/previous: ${releaseDir}`);
    }

    await fsp.rm(releaseDir, { recursive: true, force: true });
    await fsp.mkdir(releaseDir, { recursive: true });
  }

  private async copySourceTree(sourceRoot: string, targetDir: string): Promise<void> {
    const resolvedSource = path.resolve(sourceRoot);
    await fsp.cp(resolvedSource, targetDir, {
      recursive: true,
      force: true,
      filter: (sourcePath) => {
        const relative = path.relative(resolvedSource, sourcePath);
        if (!relative) {
          return true;
        }

        const topLevel = relative.split(path.sep)[0];
        return !['node_modules', '.next', 'dist', 'releases', 'shared', 'current', 'previous'].includes(topLevel);
      },
    });
  }

  private async linkSharedIntoRelease(
    releaseDir: string,
    runtime: UpdateStepExecutionContext['runtime'],
  ): Promise<void> {
    const backendEnvPath = await this.resolveExistingPath([
      path.join(runtime.sharedDir, 'config', 'backend.env'),
      path.join(runtime.sharedDir, '.env'),
    ]);
    if (!backendEnvPath) {
      throw new Error(`Arquivo de ambiente backend nao encontrado em ${runtime.sharedDir}.`);
    }

    const frontendEnvPath = await this.resolveExistingPath([
      path.join(runtime.sharedDir, 'config', 'frontend.env'),
      path.join(runtime.sharedDir, '.env.frontend.local'),
    ]);

    await this.createDirSymlink(backendEnvPath, path.join(releaseDir, '.env'), true);
    await fsp.mkdir(path.join(releaseDir, 'apps', 'backend'), { recursive: true });
    await this.createDirSymlink(backendEnvPath, path.join(releaseDir, 'apps', 'backend', '.env'), true);
    await fsp.mkdir(path.join(releaseDir, 'apps', 'frontend'), { recursive: true });
    if (frontendEnvPath) {
      await this.createDirSymlink(frontendEnvPath, path.join(releaseDir, 'apps', 'frontend', '.env.local'), true);
    }

    await fsp.mkdir(path.join(runtime.sharedDir, 'uploads'), { recursive: true });
    await fsp.mkdir(path.join(runtime.sharedDir, 'backups'), { recursive: true });
    await this.createDirSymlink(path.join(runtime.sharedDir, 'uploads'), path.join(releaseDir, 'uploads'));
    await this.createDirSymlink(path.join(runtime.sharedDir, 'backups'), path.join(releaseDir, 'backups'));
  }

  private async resetReleaseBuildOutputs(releaseDir: string): Promise<void> {
    await fsp.rm(path.join(releaseDir, 'apps', 'backend', 'dist'), { recursive: true, force: true });
    await fsp.rm(path.join(releaseDir, 'apps', 'frontend', '.next'), { recursive: true, force: true });
  }

  private async buildNativeCommandEnv(runtime: UpdateStepExecutionContext['runtime']): Promise<NodeJS.ProcessEnv> {
    const sharedEnvPath = await this.resolveExistingPath([
      path.join(runtime.sharedDir, 'config', 'backend.env'),
      path.join(runtime.sharedDir, '.env'),
    ]);

    const env: NodeJS.ProcessEnv = {
      UPLOADS_DIR: path.join(runtime.sharedDir, 'uploads'),
      BACKUP_DIR: path.join(runtime.sharedDir, 'backups'),
    };

    if (!sharedEnvPath) {
      return env;
    }

    const parsed = this.parseEnvFile(await fsp.readFile(sharedEnvPath, 'utf8'));
    return {
      ...parsed,
      ...env,
    };
  }

  private async buildFrontendCommandEnv(
    releaseDir: string,
    runtime: UpdateStepExecutionContext['runtime'],
    overrides: NodeJS.ProcessEnv = {},
  ): Promise<NodeJS.ProcessEnv> {
    const backendEnv = await this.buildNativeCommandEnv(runtime);
    const frontendEnvPath = await this.resolveExistingPath([
      path.join(releaseDir, 'apps', 'frontend', '.env.local'),
      path.join(runtime.sharedDir, 'config', 'frontend.env'),
      path.join(runtime.sharedDir, '.env.frontend.local'),
    ]);

    if (!frontendEnvPath) {
      return {
        ...backendEnv,
        ...overrides,
      };
    }

    const parsedFrontendEnv = this.parseEnvFile(await fsp.readFile(frontendEnvPath, 'utf8'));
    return {
      ...backendEnv,
      ...parsedFrontendEnv,
      ...overrides,
    };
  }

  private async runCommandOrThrow(
    context: UpdateStepExecutionContext,
    step: UpdateStepCode,
    command: string,
    args: string[],
    cwd: string,
    env?: NodeJS.ProcessEnv,
  ) {
    const result = await this.commandRunner.run({
      executionId: context.execution.id,
      step,
      command,
      args,
      cwd,
      env,
      logDir: context.runtime.logsDir,
    });

    if (result.exitCode !== 0) {
      throw new UpdateRuntimeStepError({
        code: `UPDATE_${step.toUpperCase()}_COMMAND_FAILED`,
        category: `UPDATE_${step.toUpperCase()}_FAILED`,
        stage: step,
        userMessage: `Falha ao executar ${command} na etapa ${step}.`,
        technicalMessage: `${command} ${args.join(' ')} falhou com exitCode=${result.exitCode}. ${result.stderr || result.stdout}`.trim(),
        exitCode: result.exitCode,
        commandRunId: result.commandRunId,
        retryable: step === 'restart_services' || step === 'healthcheck',
        rollbackEligible: step !== 'fetch_code',
        details: {
          command,
          args,
          cwd,
        },
      });
    }

    return result;
  }

  private async resolveFrontendLayout(frontendDir: string): Promise<{
    label: string;
    entryRelativePath: string;
    runtimeDirRelativePath: string;
    buildDirRelativePath: string;
  }> {
    const resolverScript = path.join(frontendDir, 'scripts', 'start-standalone.mjs');
    if (await this.pathExists(resolverScript)) {
      const resolvedByScript = spawnSync(process.execPath, [resolverScript, '--print-layout'], {
        cwd: frontendDir,
        encoding: 'utf8',
      });
      if (resolvedByScript.status === 0) {
        const [label, entryRelativePath, runtimeDirRelativePath, buildDirRelativePath] = String(
          resolvedByScript.stdout || '',
        )
          .trim()
          .split('|');
        if (label && entryRelativePath && runtimeDirRelativePath && buildDirRelativePath) {
          return {
            label,
            entryRelativePath,
            runtimeDirRelativePath,
            buildDirRelativePath,
          };
        }
      }
    }

    const candidates = [
      {
        label: 'monorepo-nested',
        entryRelativePath: path.join('.next', 'standalone', 'apps', 'frontend', 'server.js'),
        runtimeDirRelativePath: path.join('.next', 'standalone', 'apps', 'frontend'),
        buildDirRelativePath: path.join('.next', 'standalone', 'apps', 'frontend', '.next'),
      },
      {
        label: 'root',
        entryRelativePath: path.join('.next', 'standalone', 'server.js'),
        runtimeDirRelativePath: path.join('.next', 'standalone'),
        buildDirRelativePath: path.join('.next', 'standalone', '.next'),
      },
    ];

    const resolved = candidates.find((candidate) =>
      fs.existsSync(path.join(frontendDir, candidate.entryRelativePath)),
    );
    if (!resolved) {
      const checkedPaths = candidates.map((candidate) => path.join(frontendDir, candidate.entryRelativePath));
      throw new Error(
        `Entrypoint standalone do frontend nao encontrado em ${frontendDir}. Caminhos verificados: ${checkedPaths.join(' | ')}`,
      );
    }

    return resolved;
  }

  private async copyFrontendRuntimeAssets(
    frontendDir: string,
    layout: {
      runtimeDirRelativePath: string;
      buildDirRelativePath: string;
    },
  ): Promise<void> {
    const buildDir = path.join(frontendDir, '.next');
    const runtimeDir = path.join(frontendDir, layout.runtimeDirRelativePath);
    const standaloneBuildDir = path.join(frontendDir, layout.buildDirRelativePath);

    if (await this.pathExists(path.join(frontendDir, 'public'))) {
      await fsp.cp(path.join(frontendDir, 'public'), path.join(runtimeDir, 'public'), {
        recursive: true,
        force: true,
      });
    }

    if (await this.pathExists(path.join(buildDir, 'static'))) {
      await fsp.cp(path.join(buildDir, 'static'), path.join(standaloneBuildDir, 'static'), {
        recursive: true,
        force: true,
      });
    }
  }

  private async validateFrontendArtifactLayout(
    frontendDir: string,
    layout: {
      entryRelativePath: string;
      runtimeDirRelativePath: string;
      buildDirRelativePath: string;
    },
  ): Promise<void> {
    const buildDir = path.join(frontendDir, '.next');
    const runtimeDir = path.join(frontendDir, layout.runtimeDirRelativePath);
    const standaloneBuildDir = path.join(frontendDir, layout.buildDirRelativePath);

    const requiredPaths = [
      path.join(frontendDir, layout.entryRelativePath),
      path.join(buildDir, 'BUILD_ID'),
      path.join(standaloneBuildDir, 'BUILD_ID'),
    ];
    for (const requiredPath of requiredPaths) {
      if (!(await this.pathExists(requiredPath))) {
        throw new Error(`Artefato frontend incompleto: ${requiredPath}`);
      }
    }

    const buildId = (await fsp.readFile(path.join(buildDir, 'BUILD_ID'), 'utf8')).trim();
    const standaloneBuildId = (await fsp.readFile(path.join(standaloneBuildDir, 'BUILD_ID'), 'utf8')).trim();
    if (!buildId || buildId !== standaloneBuildId) {
      throw new Error('BUILD_ID inconsistente entre build e standalone do frontend.');
    }

    if (
      (await this.pathExists(path.join(buildDir, 'static'))) &&
      !(await this.pathExists(path.join(standaloneBuildDir, 'static')))
    ) {
      throw new Error('Diretorio .next/static nao foi copiado para o standalone do frontend.');
    }

    if ((await this.pathExists(path.join(frontendDir, 'public'))) && !(await this.pathExists(path.join(runtimeDir, 'public')))) {
      throw new Error('Diretorio public nao foi copiado para o standalone do frontend.');
    }

    const sourceManifestCount = await this.countFrontendManifestFiles(path.join(buildDir, 'server'));
    const standaloneManifestCount = await this.countFrontendManifestFiles(path.join(standaloneBuildDir, 'server'));
    if (sourceManifestCount > 0 && standaloneManifestCount === 0) {
      throw new Error('Standalone do frontend sem manifests de referencia obrigatorios.');
    }

    const source500Page = path.join(buildDir, 'server', 'pages', '500.html');
    const standalone500Page = path.join(standaloneBuildDir, 'server', 'pages', '500.html');
    if ((await this.pathExists(source500Page)) && !(await this.pathExists(standalone500Page))) {
      throw new Error('Artefato do standalone nao contem a pagina estatica 500 esperada.');
    }
  }

  private async smokeTestRelease(
    releaseDir: string,
    context: UpdateStepExecutionContext,
  ): Promise<Record<string, unknown>> {
    const frontendDir = path.join(releaseDir, 'apps', 'frontend');
    const layout = await this.resolveFrontendLayout(frontendDir);
    const port = Number(process.env.UPDATE_PRE_SWITCH_FRONTEND_PORT || 5100);
    const startCommand = await this.resolveFrontendStartCommand(frontendDir, layout);

    const background = await this.commandRunner.startBackground({
      executionId: context.execution.id,
      step: 'pre_switch_validation',
      command: startCommand.command,
      args: startCommand.args,
      cwd: frontendDir,
      env: await this.buildFrontendCommandEnv(releaseDir, context.runtime, {
        PORT: String(port),
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
      }),
      logDir: context.runtime.logsDir,
      metadata: {
        smokeTest: true,
        launcher: startCommand.launcher,
      },
    });

    try {
      await this.probeService.waitForReady({
        url: `http://127.0.0.1:${port}/api/health`,
        timeoutMs: Number(process.env.UPDATE_PRE_SWITCH_HEALTH_TIMEOUT_MS || 120_000),
      });

      const rootHtml = await this.assertHttpOk(`http://127.0.0.1:${port}/`, 'rota / do smoke test');
      const loginHtml = await this.assertHttpOk(`http://127.0.0.1:${port}/login`, 'rota /login do smoke test');
      const staticAsset = this.extractStaticAssetPath(loginHtml) || this.extractStaticAssetPath(rootHtml);
      if (!staticAsset) {
        throw new Error('Nenhum asset estatico do frontend foi localizado no smoke test.');
      }
      await this.assertHttpOk(`http://127.0.0.1:${port}${staticAsset}`, `asset estatico ${staticAsset}`);

      return {
        smokeFrontendPort: port,
        staticAsset,
        launcher: startCommand.launcher,
        startCommand: [startCommand.command, ...startCommand.args].join(' '),
      };
    } finally {
      await background.stop();
    }
  }

  private async resolveFrontendStartCommand(
    frontendDir: string,
    layout: {
      entryRelativePath: string;
    },
  ): Promise<{
    command: string;
    args: string[];
    launcher: 'start_standalone_script' | 'direct_standalone_entry';
  }> {
    const standaloneScriptRelativePath = path.join('scripts', 'start-standalone.mjs');
    if (await this.pathExists(path.join(frontendDir, standaloneScriptRelativePath))) {
      return {
        command: 'node',
        args: [standaloneScriptRelativePath],
        launcher: 'start_standalone_script',
      };
    }

    return {
      command: 'node',
      args: [layout.entryRelativePath],
      launcher: 'direct_standalone_entry',
    };
  }

  private async countFrontendManifestFiles(baseDir: string): Promise<number> {
    if (!(await this.pathExists(baseDir))) {
      return 0;
    }

    let total = 0;
    const stack = [baseDir];
    while (stack.length > 0) {
      const currentDir = stack.pop();
      if (!currentDir) {
        continue;
      }

      const entries = await fsp.readdir(currentDir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }

        if (/client-reference-manifest|server-reference-manifest/i.test(entry.name)) {
          total += 1;
        }
      }
    }

    return total;
  }

  private async restartPm2(
    releaseDir: string,
    context: UpdateStepExecutionContext,
  ): Promise<Record<string, unknown>> {
    const backendName =
      this.getMetadataString(context.metadata, 'pm2BackendName') ||
      String(process.env.PM2_BACKEND_NAME || 'multitenant-backend');
    const frontendName =
      this.getMetadataString(context.metadata, 'pm2FrontendName') ||
      String(process.env.PM2_FRONTEND_NAME || 'multitenant-frontend');
    const frontendDir = path.join(releaseDir, 'apps', 'frontend');
    const layout = await this.resolveFrontendLayout(frontendDir);
    const startCommand = await this.resolveFrontendStartCommand(frontendDir, layout);

    await this.commandRunner.run({
      executionId: context.execution.id,
      step: 'restart_services',
      command: 'pm2',
      args: ['delete', backendName],
      cwd: context.runtime.baseDir,
      logDir: context.runtime.logsDir,
    });
    await this.commandRunner.run({
      executionId: context.execution.id,
      step: 'restart_services',
      command: 'pm2',
      args: ['delete', frontendName],
      cwd: context.runtime.baseDir,
      logDir: context.runtime.logsDir,
    });

    const restartedServices: Array<Record<string, unknown>> = [];
    const serviceFailures: Array<Record<string, unknown>> = [];

    const backendStart = await this.commandRunner.run({
      executionId: context.execution.id,
      step: 'restart_services',
      command: 'pm2',
      args: ['start', 'dist/main.js', '--name', backendName, '--cwd', path.join(releaseDir, 'apps', 'backend'), '--update-env'],
      cwd: context.runtime.baseDir,
      logDir: context.runtime.logsDir,
    });
    if (backendStart.exitCode === 0) {
      restartedServices.push({
        service: 'backend',
        processName: backendName,
        commandRunId: backendStart.commandRunId,
      });
    } else {
      serviceFailures.push({
        service: 'backend',
        processName: backendName,
        exitCode: backendStart.exitCode,
        commandRunId: backendStart.commandRunId,
      });
    }

    const frontendStart = await this.commandRunner.run({
      executionId: context.execution.id,
      step: 'restart_services',
      command: 'pm2',
      args: [
        'start',
        `${startCommand.command} ${startCommand.args.join(' ')}`,
        '--name',
        frontendName,
        '--cwd',
        frontendDir,
        '--update-env',
      ],
      cwd: context.runtime.baseDir,
      env: await this.buildFrontendCommandEnv(releaseDir, context.runtime, {
        PORT: String(process.env.FRONTEND_PORT || 5000),
        HOSTNAME: '0.0.0.0',
        NODE_ENV: 'production',
      }),
      logDir: context.runtime.logsDir,
      metadata: {
        launcher: startCommand.launcher,
      },
    });
    if (frontendStart.exitCode === 0) {
      restartedServices.push({
        service: 'frontend',
        processName: frontendName,
        commandRunId: frontendStart.commandRunId,
      });
    } else {
      serviceFailures.push({
        service: 'frontend',
        processName: frontendName,
        exitCode: frontendStart.exitCode,
        commandRunId: frontendStart.commandRunId,
      });
    }

    if (serviceFailures.length > 0) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_RESTART_PARTIAL_FAILURE',
        category: 'UPDATE_RESTART_FAILED',
        stage: 'restart_services',
        userMessage: 'Falha parcial ao reiniciar os serviços publicados.',
        technicalMessage: serviceFailures.map((failure) => JSON.stringify(failure)).join('; '),
        retryable: true,
        rollbackEligible: true,
        commandRunId: String(serviceFailures[0]?.commandRunId || ''),
        details: {
          restartedServices,
          serviceFailures,
        },
      });
    }

    await this.runCommandOrThrow(context, 'restart_services', 'pm2', ['save'], context.runtime.baseDir);
    const pm2Processes = await this.inspectPm2Processes(context, 'restart_services');
    const observed = this.collectPm2Evidence(pm2Processes, {
      backendName,
      frontendName,
    });

    if (!observed.backend.online || !observed.frontend.online) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_RESTART_CONFIRMATION_FAILED',
        category: 'UPDATE_RESTART_FAILED',
        stage: 'restart_services',
        userMessage: 'Os serviços foram iniciados, mas o PM2 não confirmou ambos como online.',
        technicalMessage: `backend=${observed.backend.status}; frontend=${observed.frontend.status}`,
        retryable: true,
        rollbackEligible: true,
        details: observed,
      });
    }

    return {
      pm2BackendName: backendName,
      pm2FrontendName: frontendName,
      restartedServices,
      serviceFailures,
      pm2Status: observed,
    };
  }

  private async performHealthcheck(
    releaseDir: string,
    context: UpdateStepExecutionContext,
  ): Promise<Record<string, unknown>> {
    const backendName =
      this.getMetadataString(context.metadata, 'pm2BackendName') ||
      String(process.env.PM2_BACKEND_NAME || 'multitenant-backend');
    const frontendName =
      this.getMetadataString(context.metadata, 'pm2FrontendName') ||
      String(process.env.PM2_FRONTEND_NAME || 'multitenant-frontend');
    const pm2Processes = await this.inspectPm2Processes(context, 'healthcheck');
    const pm2Status = this.collectPm2Evidence(pm2Processes, {
      backendName,
      frontendName,
    });
    if (!pm2Status.backend.online || !pm2Status.frontend.online) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_HEALTHCHECK_PM2_NOT_ONLINE',
        category: 'UPDATE_HEALTHCHECK_FAILED',
        stage: 'healthcheck',
        userMessage: 'Os processos publicados não ficaram online no PM2.',
        technicalMessage: `backend=${pm2Status.backend.status}; frontend=${pm2Status.frontend.status}`,
        retryable: true,
        rollbackEligible: true,
        details: pm2Status,
      });
    }

    const env = await this.buildNativeCommandEnv(context.runtime);
    const backendPort = Number(env.PORT || process.env.PORT || 4000);
    const frontendPort = Number(process.env.FRONTEND_PORT || 5000);
    const backendUrl = `http://127.0.0.1:${backendPort}/api/health`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}/api/health`;

    await this.probeService.waitForReady({
      url: backendUrl,
      timeoutMs: Number(process.env.UPDATE_LIVE_HEALTH_TIMEOUT_MS || 120_000),
    });
    await this.probeService.waitForReady({
      url: frontendUrl,
      timeoutMs: Number(process.env.UPDATE_LIVE_HEALTH_TIMEOUT_MS || 120_000),
    });

    const observedCurrentReleaseRef = await this.safeRealpath(context.runtime.currentDir);
    const expectedCurrentReleaseRef = (await this.safeRealpath(releaseDir)) || releaseDir;
    if (!observedCurrentReleaseRef || !this.isSameResolvedPath(observedCurrentReleaseRef, expectedCurrentReleaseRef)) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_HEALTHCHECK_RELEASE_MISMATCH',
        category: 'UPDATE_HEALTHCHECK_FAILED',
        stage: 'healthcheck',
        userMessage: 'A release ativa observada não corresponde à release alvo publicada.',
        technicalMessage: `current=${observedCurrentReleaseRef || 'null'} expected=${expectedCurrentReleaseRef}`,
        retryable: false,
        rollbackEligible: true,
        details: {
          observedCurrentReleaseRef,
          expectedReleaseRef: expectedCurrentReleaseRef,
        },
      });
    }

    const observedVersion = await this.readObservedVersion(releaseDir);
    if (observedVersion && observedVersion !== context.execution.targetVersion) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_HEALTHCHECK_VERSION_MISMATCH',
        category: 'UPDATE_HEALTHCHECK_FAILED',
        stage: 'healthcheck',
        userMessage: 'A versão observada após o publish não corresponde à versão alvo.',
        technicalMessage: `observed=${observedVersion} expected=${context.execution.targetVersion}`,
        retryable: false,
        rollbackEligible: true,
        details: {
          observedVersion,
          expectedVersion: context.execution.targetVersion,
        },
      });
    }

    // Dependencias externas com efeito de dados ficam em post_validation, onde ja existe sonda confiavel de storage compartilhado.

    return {
      releaseDir,
      observedCurrentReleaseRef,
      observedVersion: observedVersion || null,
      pm2Status,
      backendUrl,
      frontendUrl,
    };
  }

  private async performLiveValidation(
    releaseDir: string,
    context: UpdateStepExecutionContext,
    rollback: boolean,
  ): Promise<Record<string, unknown>> {
    const env = await this.buildNativeCommandEnv(context.runtime);
    const backendPort = Number(env.PORT || process.env.PORT || 4000);
    const frontendPort = Number(process.env.FRONTEND_PORT || 5000);
    const backendUrl = `http://127.0.0.1:${backendPort}/api/health`;
    const frontendHealthUrl = `http://127.0.0.1:${frontendPort}/api/health`;
    const rootHtml = await this.assertHttpOk(`http://127.0.0.1:${frontendPort}/`, 'rota / em runtime');
    const loginHtml = await this.assertHttpOk(`http://127.0.0.1:${frontendPort}/login`, 'rota /login em runtime');
    const staticAsset = this.extractStaticAssetPath(loginHtml) || this.extractStaticAssetPath(rootHtml);
    if (!staticAsset) {
      throw new Error('Nenhum asset estatico foi localizado no frontend publicado.');
    }

    await this.assertHttpOk(backendUrl, 'healthcheck do backend');
    await this.assertHttpOk(frontendHealthUrl, 'healthcheck do frontend');
    await this.assertHttpOk(`http://127.0.0.1:${frontendPort}${staticAsset}`, `asset estatico ${staticAsset}`);

    await this.validateBackendSharedStorage(releaseDir, context);

    return {
      rollback,
      backendUrl,
      frontendHealthUrl,
      staticAsset,
    };
  }

  private async validateBackendSharedStorage(
    releaseDir: string,
    context: UpdateStepExecutionContext,
  ): Promise<void> {
    const backendDir = path.join(releaseDir, 'apps', 'backend');
    const probeFile = path.join(backendDir, '.update-shared-storage-probe.cjs');
    const probeScript = [
      "let Redis;",
      "try { Redis = require(require.resolve('ioredis', { paths: [process.cwd()] })); } catch (error) { console.error('Dependencia ioredis nao encontrada.'); process.exit(1); }",
      "const host = process.env.REDIS_HOST || '127.0.0.1';",
      "const port = Number(process.env.REDIS_PORT || 6379);",
      "const password = process.env.REDIS_PASSWORD || undefined;",
      "const db = Number(process.env.REDIS_DB || 0);",
      "const client = new Redis({ host, port, password, db, connectTimeout: 1000, maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: true });",
      "async function run() { if (client.status === 'wait') { await client.connect(); } const pong = await client.ping(); if (pong !== 'PONG') { throw new Error(`Redis ping inesperado: ${pong}`); } const key = `update:shared-storage:${Date.now()}`; await client.set(key, 'ok', 'EX', 20); const value = await client.get(key); if (value !== 'ok') { throw new Error('Falha no teste SET/GET do storage compartilhado'); } await client.del(key); await client.quit(); }",
      "run().then(() => process.exit(0)).catch(async (error) => { try { await client.quit(); } catch {} console.error(error?.message || error); process.exit(1); });",
    ].join('\n');

    await fsp.writeFile(probeFile, probeScript, 'utf8');

    try {
      await this.runCommandOrThrow(
        context,
        'post_validation',
        'node',
        [path.basename(probeFile)],
        backendDir,
        await this.buildNativeCommandEnv(context.runtime),
      );
    } finally {
      await fsp.rm(probeFile, { force: true });
    }
  }

  private async assertHttpOk(url: string, label: string): Promise<string> {
    const body = await this.probeService.fetchText(url, 10_000);
    if (/Invariant: The client reference manifest|Failed to load static file|Failed to find Server Action/i.test(body)) {
      throw new Error(`Resposta invalida em ${label}: ${url}`);
    }
    return body;
  }

  private extractStaticAssetPath(html: string): string | null {
    const match = html.match(/\/_next\/static\/[^"'\\\s<]+/);
    return match?.[0] || null;
  }

  private async writeBuildMetadataFiles(
    releaseDir: string,
    context: UpdateStepExecutionContext,
  ): Promise<void> {
    const version = context.execution.targetVersion || 'unknown';
    const buildInfo = {
      version,
      commitSha: String(process.env.BUILD_COMMIT_SHA || 'unknown'),
      buildDate: new Date().toISOString(),
      branch: String(process.env.BUILD_BRANCH || ''),
    };

    await fsp.writeFile(path.join(releaseDir, 'VERSION'), `${version}\n`, 'utf8');
    await fsp.writeFile(
      path.join(releaseDir, 'BUILD_INFO.json'),
      JSON.stringify(buildInfo, null, 2),
      'utf8',
    );
  }

  private sanitizeReleaseName(input: string): string {
    return String(input || 'release')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'release';
  }

  private parseEnvFile(content: string): NodeJS.ProcessEnv {
    return content.split(/\r?\n/).reduce<NodeJS.ProcessEnv>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return acc;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) {
        return acc;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      acc[key] = value;
      return acc;
    }, {});
  }

  private getMetadataString(metadata: UpdateExecutionMetadata, key: string): string | null {
    const value = metadata?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private async resolveExistingPath(candidates: string[]): Promise<string | null> {
    for (const candidate of candidates) {
      if (await this.pathExists(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private async createDirSymlink(target: string, linkPath: string, file = false): Promise<void> {
    await fsp.rm(linkPath, { recursive: !file, force: true });
    await fsp.mkdir(path.dirname(linkPath), { recursive: true });
    try {
      await fsp.symlink(
        target,
        linkPath,
        process.platform === 'win32' ? (file ? 'file' : 'junction') : file ? 'file' : 'dir',
      );
    } catch (error) {
      if (!file) {
        throw error;
      }

      await fsp.copyFile(target, linkPath);
    }
  }

  private async safeRealpath(targetPath: string): Promise<string | null> {
    try {
      return await fsp.realpath(targetPath);
    } catch {
      return null;
    }
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fsp.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async assertRequiredReleaseFiles(releaseDir: string): Promise<void> {
    const requiredPaths = [
      path.join(releaseDir, 'apps', 'backend', 'package.json'),
      path.join(releaseDir, 'apps', 'frontend', 'package.json'),
    ];

    for (const requiredPath of requiredPaths) {
      if (!(await this.pathExists(requiredPath))) {
        throw new UpdateRuntimeStepError({
          code: 'UPDATE_FETCH_CODE_RELEASE_INCOMPLETE',
          category: 'UPDATE_FETCH_CODE_FAILED',
          stage: 'fetch_code',
          userMessage: 'A release obtida não contém os artefatos mínimos esperados.',
          technicalMessage: `Arquivo obrigatório ausente: ${requiredPath}`,
          retryable: false,
          rollbackEligible: false,
          details: {
            releaseDir,
            missingPath: requiredPath,
          },
        });
      }
    }
  }

  private async inspectPm2Processes(
    context: UpdateStepExecutionContext,
    step: 'restart_services' | 'healthcheck',
  ): Promise<Array<Record<string, unknown>>> {
    const result = await this.runCommandOrThrow(
      context,
      step,
      'pm2',
      ['jlist'],
      context.runtime.baseDir,
    );

    try {
      return JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    } catch (error) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_PM2_JLIST_INVALID',
        category: step === 'healthcheck' ? 'UPDATE_HEALTHCHECK_FAILED' : 'UPDATE_RESTART_FAILED',
        stage: step,
        userMessage: 'O PM2 não retornou um inventário estruturado válido.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        retryable: true,
        rollbackEligible: true,
        commandRunId: result.commandRunId,
        details: {
          rawOutput: result.stdout,
        },
      });
    }
  }

  private collectPm2Evidence(
    processes: Array<Record<string, unknown>>,
    names: {
      backendName: string;
      frontendName: string;
    },
  ): NativePm2StatusEvidence {
    const resolveProcess = (name: string) => {
      const found = processes.find((entry) => String(entry.name || '') === name);
      const pm2Env =
        found && typeof found.pm2_env === 'object' && found.pm2_env !== null
          ? (found.pm2_env as Record<string, unknown>)
          : {};

      return {
        processName: name,
        found: Boolean(found),
        status: String(pm2Env.status || 'missing'),
        pid: Number(pm2Env.pm_id || -1),
        online: String(pm2Env.status || '') === 'online',
      };
    };

    return {
      backend: resolveProcess(names.backendName),
      frontend: resolveProcess(names.frontendName),
    };
  }

  private async readObservedVersion(releaseDir: string): Promise<string | null> {
    const candidates = [
      path.join(releaseDir, 'VERSION'),
      path.join(releaseDir, 'BUILD_INFO.json'),
    ];

    for (const candidate of candidates) {
      if (!(await this.pathExists(candidate))) {
        continue;
      }

      if (candidate.endsWith('.json')) {
        try {
          const parsed = JSON.parse(await fsp.readFile(candidate, 'utf8')) as Record<string, unknown>;
          const version = typeof parsed.version === 'string' ? parsed.version.trim() : '';
          if (version) {
            return version;
          }
        } catch {
          continue;
        }
      } else {
        const version = (await fsp.readFile(candidate, 'utf8')).trim();
        if (version) {
          return version;
        }
      }
    }

    return null;
  }

  private isSameResolvedPath(left: string, right: string): boolean {
    return path.normalize(left).toLowerCase() === path.normalize(right).toLowerCase();
  }
}
