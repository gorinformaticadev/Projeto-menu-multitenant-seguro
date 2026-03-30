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
  pmId: number;
  online: boolean;
  cwd: string | null;
  execPath: string | null;
  args: string[];
  port: number | null;
  pointsToExpectedRelease: boolean | null;
};

type NativePm2StatusEvidence = {
  backend: NativePm2ProcessEvidence;
  frontend: NativePm2ProcessEvidence;
  backendConflicts: NativePm2ProcessEvidence[];
  frontendConflicts: NativePm2ProcessEvidence[];
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
    const releasePreparation = await this.prepareTargetReleaseDir(releaseDir, context.runtime);

    const localSourcePath =
      this.getMetadataString(context.metadata, 'localSourcePath') ||
      String(process.env.UPDATE_LOCAL_SOURCE_PATH || '').trim();
    const gitRepoUrl =
      this.getMetadataString(context.metadata, 'gitRepoUrl') ||
      String(process.env.GIT_REPO_URL || '').trim();
    const gitAuthHeader =
      this.getMetadataString(context.metadata, 'gitAuthHeader') ||
      String(process.env.GIT_AUTH_HEADER || '').trim();

    try {
      if (releasePreparation.action !== 'reused') {
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
              releasePreparationAction: releasePreparation.action,
            },
          });
        } else if (gitRepoUrl) {
          const args = gitAuthHeader
            ? ['-c', gitAuthHeader, 'clone', '--depth', '1', '--branch', context.execution.targetVersion, gitRepoUrl, releaseDir]
            : ['clone', '--depth', '1', '--branch', context.execution.targetVersion, gitRepoUrl, releaseDir];
          await this.runCommandOrThrow(context, 'fetch_code', 'git', args, context.runtime.baseDir);
        } else {
          throw new UpdateRuntimeStepError({
            code: 'UPDATE_FETCH_CODE_SOURCE_NOT_CONFIGURED',
            category: 'UPDATE_FETCH_CODE_FAILED',
            stage: 'fetch_code',
            userMessage: 'Nenhuma origem de release foi configurada para a etapa de download.',
            technicalMessage: 'localSourcePath e gitRepoUrl estao ausentes para fetch_code.',
            retryable: false,
            rollbackEligible: false,
            details: {
              releaseDir,
              releasePreparation,
            },
          });
        }
      }

      await this.linkSharedIntoRelease(releaseDir, context.runtime);
      await this.resetReleaseBuildOutputs(releaseDir);
      await this.assertRequiredReleaseFiles(releaseDir);
    } catch (error) {
      if (error instanceof UpdateRuntimeStepError) {
        throw error;
      }

      throw new UpdateRuntimeStepError({
        code: 'UPDATE_FETCH_CODE_PREPARATION_FAILED',
        category: 'UPDATE_FETCH_CODE_FAILED',
        stage: 'fetch_code',
        userMessage: 'Falha ao preparar a release alvo do update.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        retryable: false,
        rollbackEligible: false,
        details: {
          releaseDir,
          releasePreparation,
          localSourcePath: localSourcePath || null,
          gitRepoUrl: gitRepoUrl || null,
        },
      });
    }

    const sourceType =
      releasePreparation.action === 'reused' ? 'existing_release' : localSourcePath ? 'local_source_path' : 'git_clone';

    return {
      result: {
        releaseDir,
        sourceType,
        resolvedVersion: context.execution.targetVersion,
        releasePreparation,
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
            sourceType,
            releasePreparation,
          },
        },
        {
          code: 'manifestos_detectados',
          summary: 'Os manifestos mínimos do backend e frontend foram encontrados.',
          details: {
            checkedPaths: this.getReleaseIntegrityRequiredPaths(releaseDir),
          },
        },
        ...(releasePreparation.action === 'reused'
          ? [
              {
                code: 'release_existente_reutilizada',
                summary: 'A release alvo ja existia e foi reutilizada porque a estrutura minima estava integra.',
                details: releasePreparation,
              },
            ]
          : releasePreparation.action === 'recreated'
            ? [
                {
                  code: 'release_existente_reconstruida',
                  summary: 'A release alvo ja existia, estava invalida e foi reconstruida do zero.',
                  details: releasePreparation,
                },
              ]
            : []),
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
    const seedCommand = await this.resolveNativeSeedCommand(backendDir);
    await this.runCommandOrThrow(
      context,
      'seed',
      seedCommand.command,
      seedCommand.args,
      backendDir,
      await this.buildNativeCommandEnv(context.runtime),
    );

    return {
      result: {
        backendDir,
        commandSource: seedCommand.source,
        resolvedCommand: [seedCommand.command, ...seedCommand.args].join(' '),
      },
      metadata: {
        seedCommandSource: seedCommand.source,
        seedCommand: [seedCommand.command, ...seedCommand.args].join(' '),
      },
      evidence: [
        {
          code: 'seed_entrypoint_resolvido',
          summary: 'O seed versionado foi resolvido a partir do contrato canonico da release.',
          details: {
            source: seedCommand.source,
            resolvedCommand: [seedCommand.command, ...seedCommand.args].join(' '),
            backendDir,
          },
        },
      ],
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
  ): Promise<{
    action: 'created' | 'reused' | 'recreated';
    checkedPaths: string[];
    missingPaths: string[];
  }> {
    const currentTarget = await this.safeRealpath(runtime.currentDir);
    const previousTarget = await this.safeRealpath(runtime.previousDir);

    if (releaseDir === currentTarget || releaseDir === previousTarget) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_FETCH_CODE_RELEASE_PROTECTED',
        category: 'UPDATE_FETCH_CODE_FAILED',
        stage: 'fetch_code',
        userMessage: 'A release alvo esta protegida pelos ponteiros current/previous e nao pode ser recriada.',
        technicalMessage: `Release protegida por current/previous: ${releaseDir}`,
        retryable: false,
        rollbackEligible: false,
        details: {
          releaseDir,
          currentTarget,
          previousTarget,
        },
      });
    }

    if (!(await this.pathExists(releaseDir))) {
      await fsp.mkdir(releaseDir, { recursive: true });
      return {
        action: 'created',
        checkedPaths: [],
        missingPaths: [],
      };
    }

    const inspection = await this.inspectReleaseDirectoryIntegrity(releaseDir);
    if (inspection.valid) {
      return {
        action: 'reused',
        checkedPaths: inspection.checkedPaths,
        missingPaths: [],
      };
    }

    try {
      await fsp.rm(releaseDir, { recursive: true, force: true });
      await fsp.mkdir(releaseDir, { recursive: true });
    } catch (error) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_FETCH_CODE_RELEASE_RESET_FAILED',
        category: 'UPDATE_FETCH_CODE_FAILED',
        stage: 'fetch_code',
        userMessage: 'A release alvo existente estava invalida e nao pode ser reconstruida.',
        technicalMessage: error instanceof Error ? error.message : String(error),
        retryable: false,
        rollbackEligible: false,
        details: {
          releaseDir,
          checkedPaths: inspection.checkedPaths,
          missingPaths: inspection.missingPaths,
        },
      });
    }

    return {
      action: 'recreated',
      checkedPaths: inspection.checkedPaths,
      missingPaths: inspection.missingPaths,
    };
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

  private async inspectReleaseDirectoryIntegrity(releaseDir: string): Promise<{
    valid: boolean;
    checkedPaths: string[];
    missingPaths: string[];
  }> {
    const checkedPaths = this.getReleaseIntegrityRequiredPaths(releaseDir);
    const missingPaths: string[] = [];

    for (const requiredPath of checkedPaths) {
      if (!(await this.pathExists(requiredPath))) {
        missingPaths.push(requiredPath);
      }
    }

    return {
      valid: missingPaths.length === 0,
      checkedPaths,
      missingPaths,
    };
  }

  private getReleaseIntegrityRequiredPaths(releaseDir: string): string[] {
    return [
      path.join(releaseDir, 'package.json'),
      path.join(releaseDir, 'pnpm-workspace.yaml'),
      path.join(releaseDir, 'pnpm-lock.yaml'),
      path.join(releaseDir, 'apps', 'backend', 'package.json'),
      path.join(releaseDir, 'apps', 'frontend', 'package.json'),
    ];
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

  private async resolveNativeSeedCommand(backendDir: string): Promise<{
    command: string;
    args: string[];
    source: 'package_json_script' | 'prisma_seed_ts' | 'dist_seed_js_legacy';
  }> {
    const packageJsonPath = path.join(backendDir, 'package.json');
    const prismaSeedSourcePath = path.join(backendDir, 'prisma', 'seed.ts');
    const legacyDistSeedPath = path.join(backendDir, 'dist', 'prisma', 'seed.js');

    const packageJson = await this.readJsonFile(packageJsonPath);
    const seedDeployScript =
      packageJson && typeof packageJson.scripts?.['seed:deploy'] === 'string'
        ? packageJson.scripts['seed:deploy'].trim()
        : '';
    if (seedDeployScript) {
      return {
        command: 'pnpm',
        args: ['run', 'seed:deploy'],
        source: 'package_json_script',
      };
    }

    if (await this.pathExists(prismaSeedSourcePath)) {
      return {
        command: 'pnpm',
        args: ['exec', 'tsx', 'prisma/seed.ts', 'deploy'],
        source: 'prisma_seed_ts',
      };
    }

    if (await this.pathExists(legacyDistSeedPath)) {
      return {
        command: 'node',
        args: ['dist/prisma/seed.js', 'deploy'],
        source: 'dist_seed_js_legacy',
      };
    }

    throw new UpdateRuntimeStepError({
      code: 'UPDATE_SEED_ENTRYPOINT_NOT_FOUND',
      category: 'UPDATE_SEED_ERROR',
      stage: 'seed',
      userMessage: 'A release nao possui um entrypoint executavel para o seed versionado.',
      technicalMessage:
        `Nenhum comando de seed executavel foi encontrado em ${backendDir}. ` +
        'Verificado: scripts.seed:deploy, prisma/seed.ts, dist/prisma/seed.js.',
      rollbackEligible: true,
      retryable: false,
      details: {
        backendDir,
        checked: {
          packageJsonPath,
          prismaSeedSourcePath,
          legacyDistSeedPath,
        },
      },
    });
  }

  private async readJsonFile(filePath: string): Promise<Record<string, any> | null> {
    if (!(await this.pathExists(filePath))) {
      return null;
    }

    try {
      return JSON.parse(await fsp.readFile(filePath, 'utf8')) as Record<string, any>;
    } catch {
      return null;
    }
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
      ...(await this.loadFrontendLayoutCandidatesFromRequiredServerFiles(frontendDir)),
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

    const uniqueCandidates = candidates.filter(
      (candidate, index, collection) =>
        collection.findIndex((current) => current.entryRelativePath === candidate.entryRelativePath) === index,
    );

    const resolved = uniqueCandidates.find((candidate) =>
      fs.existsSync(path.join(frontendDir, candidate.entryRelativePath)),
    );
    if (!resolved) {
      const checkedPaths = uniqueCandidates.map((candidate) => path.join(frontendDir, candidate.entryRelativePath));
      throw new Error(
        `Entrypoint standalone do frontend nao encontrado em ${frontendDir}. Caminhos verificados: ${checkedPaths.join(' | ')}`,
      );
    }

    return resolved;
  }

  private async loadFrontendLayoutCandidatesFromRequiredServerFiles(frontendDir: string): Promise<
    Array<{
      label: string;
      entryRelativePath: string;
      runtimeDirRelativePath: string;
      buildDirRelativePath: string;
    }>
  > {
    const requiredServerFilesPath = path.join(frontendDir, '.next', 'required-server-files.json');
    if (!(await this.pathExists(requiredServerFilesPath))) {
      return [];
    }

    try {
      const raw = await fsp.readFile(requiredServerFilesPath, 'utf8');
      const parsed = JSON.parse(raw) as { relativeAppDir?: unknown };
      const relativeAppDir = this.normalizeRequiredServerFilesAppDir(parsed.relativeAppDir);
      if (!relativeAppDir) {
        return [];
      }

      return [
        {
          label: 'required-server-files',
          entryRelativePath: path.join('.next', 'standalone', relativeAppDir, 'server.js'),
          runtimeDirRelativePath: path.join('.next', 'standalone', relativeAppDir),
          buildDirRelativePath: path.join('.next', 'standalone', relativeAppDir, '.next'),
        },
      ];
    } catch {
      return [];
    }
  }

  private normalizeRequiredServerFilesAppDir(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = path
      .normalize(value)
      .replace(/^[A-Za-z]:[\\/]/, '')
      .replace(/^([.][\\/])+/, '')
      .replace(/^[\\/]+/, '')
      .replace(/[\\/]+$/, '');

    if (!normalized || normalized === '.') {
      return null;
    }

    return normalized;
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
    const pm2Names = this.resolvePm2ProcessNames(context);
    const backendName = pm2Names.backendName;
    const frontendName = pm2Names.frontendName;
    const backendDir = path.join(releaseDir, 'apps', 'backend');
    const frontendDir = path.join(releaseDir, 'apps', 'frontend');
    const layout = await this.resolveFrontendLayout(frontendDir);
    const startCommand = await this.resolveFrontendStartCommand(frontendDir, layout);
    const pm2ProcessesBeforeRestart = await this.inspectPm2Processes(context, 'restart_services');
    const pm2ConflictingNames = this.collectConflictingPm2ProcessNames(pm2ProcessesBeforeRestart, {
      backendName,
      frontendName,
      baseDir: context.runtime.baseDir,
      expectedBackendDir: backendDir,
      expectedFrontendDir: frontendDir,
    });

    for (const processName of [backendName, frontendName, ...pm2ConflictingNames]) {
      await this.commandRunner.run({
        executionId: context.execution.id,
        step: 'restart_services',
        command: 'pm2',
        args: ['delete', processName],
        cwd: context.runtime.baseDir,
        logDir: context.runtime.logsDir,
      });
    }

    const restartedServices: Array<Record<string, unknown>> = [];
    const serviceFailures: Array<Record<string, unknown>> = [];

    const backendStart = await this.commandRunner.run({
      executionId: context.execution.id,
      step: 'restart_services',
      command: 'pm2',
      args: ['start', 'dist/main.js', '--name', backendName, '--cwd', backendDir, '--update-env'],
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
      baseDir: context.runtime.baseDir,
      expectedBackendDir: backendDir,
      expectedFrontendDir: frontendDir,
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

    if (observed.backendConflicts.length > 0 || observed.frontendConflicts.length > 0) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_RESTART_PM2_CONFLICTING_PROCESSES',
        category: 'UPDATE_RESTART_FAILED',
        stage: 'restart_services',
        userMessage: 'O PM2 manteve processos legados concorrendo com a release publicada.',
        technicalMessage:
          `backendConflicts=${observed.backendConflicts.map((process) => process.processName).join(',') || 'nenhum'}; ` +
          `frontendConflicts=${observed.frontendConflicts.map((process) => process.processName).join(',') || 'nenhum'}`,
        retryable: true,
        rollbackEligible: true,
        details: observed,
      });
    }

    if (observed.backend.pointsToExpectedRelease !== true || observed.frontend.pointsToExpectedRelease !== true) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_RESTART_RELEASE_PROCESS_MISMATCH',
        category: 'UPDATE_RESTART_FAILED',
        stage: 'restart_services',
        userMessage: 'Os processos reiniciados nao apontam para a release publicada.',
        technicalMessage:
          `backendExpected=${backendDir}; backendObserved=${observed.backend.cwd || observed.backend.execPath || 'desconhecido'}; ` +
          `frontendExpected=${frontendDir}; frontendObserved=${observed.frontend.cwd || observed.frontend.execPath || 'desconhecido'}`,
        retryable: true,
        rollbackEligible: true,
        details: observed,
      });
    }

    return {
      pm2BackendName: backendName,
      pm2FrontendName: frontendName,
      pm2NameSource: pm2Names.source,
      purgedConflictingProcesses: pm2ConflictingNames,
      restartedServices,
      serviceFailures,
      pm2Status: observed,
    };
  }

  private async performHealthcheck(
    releaseDir: string,
    context: UpdateStepExecutionContext,
  ): Promise<Record<string, unknown>> {
    const pm2Names = this.resolvePm2ProcessNames(context);
    const backendName = pm2Names.backendName;
    const frontendName = pm2Names.frontendName;
    const backendDir = path.join(releaseDir, 'apps', 'backend');
    const frontendDir = path.join(releaseDir, 'apps', 'frontend');
    const pm2Processes = await this.inspectPm2Processes(context, 'healthcheck');
    const pm2Status = this.collectPm2Evidence(pm2Processes, {
      backendName,
      frontendName,
      baseDir: context.runtime.baseDir,
      expectedBackendDir: backendDir,
      expectedFrontendDir: frontendDir,
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

    if (pm2Status.backendConflicts.length > 0 || pm2Status.frontendConflicts.length > 0) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_HEALTHCHECK_PM2_CONFLICT',
        category: 'UPDATE_HEALTHCHECK_FAILED',
        stage: 'healthcheck',
        userMessage: 'Ainda existem processos PM2 legados concorrendo com a release ativa.',
        technicalMessage:
          `backendConflicts=${pm2Status.backendConflicts.map((process) => process.processName).join(',') || 'nenhum'}; ` +
          `frontendConflicts=${pm2Status.frontendConflicts.map((process) => process.processName).join(',') || 'nenhum'}`,
        retryable: true,
        rollbackEligible: true,
        details: pm2Status,
      });
    }

    if (pm2Status.backend.pointsToExpectedRelease !== true || pm2Status.frontend.pointsToExpectedRelease !== true) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_HEALTHCHECK_RELEASE_PROCESS_MISMATCH',
        category: 'UPDATE_HEALTHCHECK_FAILED',
        stage: 'healthcheck',
        userMessage: 'Os processos online do PM2 nao correspondem a release publicada.',
        technicalMessage:
          `backendExpected=${backendDir}; backendObserved=${pm2Status.backend.cwd || pm2Status.backend.execPath || 'desconhecido'}; ` +
          `frontendExpected=${frontendDir}; frontendObserved=${pm2Status.frontend.cwd || pm2Status.frontend.execPath || 'desconhecido'}`,
        retryable: false,
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

    const runtimeVersionEvidence = await this.validateLiveRuntimeIdentity(
      context,
      'healthcheck',
      backendPort,
      context.execution.targetVersion,
    );

    // Dependencias externas com efeito de dados ficam em post_validation, onde ja existe sonda confiavel de storage compartilhado.

    return {
      releaseDir,
      observedCurrentReleaseRef,
      observedVersion: observedVersion || null,
      pm2Status,
      backendUrl,
      frontendUrl,
      runtimeVersionEvidence,
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
    const pm2Names = this.resolvePm2ProcessNames(context);
    const pm2Processes = await this.inspectPm2Processes(context, 'post_validation');
    const pm2Status = this.collectPm2Evidence(pm2Processes, {
      backendName: pm2Names.backendName,
      frontendName: pm2Names.frontendName,
      baseDir: context.runtime.baseDir,
      expectedBackendDir: path.join(releaseDir, 'apps', 'backend'),
      expectedFrontendDir: path.join(releaseDir, 'apps', 'frontend'),
    });
    if (!pm2Status.backend.online || !pm2Status.frontend.online) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_POST_DEPLOY_PM2_NOT_ONLINE',
        category: 'UPDATE_POST_DEPLOY_VALIDATION_FAILED',
        stage: 'post_validation',
        userMessage: 'Os processos PM2 nao permaneceram online apos a publicacao da release.',
        technicalMessage: `backend=${pm2Status.backend.status}; frontend=${pm2Status.frontend.status}`,
        retryable: true,
        rollbackEligible: true,
        details: pm2Status,
      });
    }

    if (pm2Status.backendConflicts.length > 0 || pm2Status.frontendConflicts.length > 0) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_POST_DEPLOY_PM2_CONFLICT',
        category: 'UPDATE_POST_DEPLOY_VALIDATION_FAILED',
        stage: 'post_validation',
        userMessage: 'Persistiram processos PM2 legados concorrendo com a release publicada.',
        technicalMessage:
          `backendConflicts=${pm2Status.backendConflicts.map((process) => process.processName).join(',') || 'nenhum'}; ` +
          `frontendConflicts=${pm2Status.frontendConflicts.map((process) => process.processName).join(',') || 'nenhum'}`,
        retryable: false,
        rollbackEligible: true,
        details: pm2Status,
      });
    }

    if (pm2Status.backend.pointsToExpectedRelease !== true || pm2Status.frontend.pointsToExpectedRelease !== true) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_POST_DEPLOY_RELEASE_PROCESS_MISMATCH',
        category: 'UPDATE_POST_DEPLOY_VALIDATION_FAILED',
        stage: 'post_validation',
        userMessage: 'O PM2 nao esta servindo a release publicada como instancia unica.',
        technicalMessage:
          `backendObserved=${pm2Status.backend.cwd || pm2Status.backend.execPath || 'desconhecido'}; ` +
          `frontendObserved=${pm2Status.frontend.cwd || pm2Status.frontend.execPath || 'desconhecido'}`,
        retryable: false,
        rollbackEligible: true,
        details: pm2Status,
      });
    }

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
    const expectedVersion = rollback
      ? (await this.readObservedVersion(releaseDir)) || context.execution.currentVersion
      : context.execution.targetVersion;
    const runtimeVersionEvidence = await this.validateLiveRuntimeIdentity(
      context,
      'post_validation',
      backendPort,
      expectedVersion,
    );

    return {
      rollback,
      backendUrl,
      frontendHealthUrl,
      staticAsset,
      pm2Status,
      runtimeVersionEvidence,
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
    const inspection = await this.inspectReleaseDirectoryIntegrity(releaseDir);
    if (!inspection.valid) {
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_FETCH_CODE_RELEASE_INCOMPLETE',
        category: 'UPDATE_FETCH_CODE_FAILED',
        stage: 'fetch_code',
        userMessage: 'A release obtida nao contem a estrutura minima esperada.',
        technicalMessage: `Arquivos obrigatorios ausentes: ${inspection.missingPaths.join(', ')}`,
        retryable: false,
        rollbackEligible: false,
        details: {
          releaseDir,
          checkedPaths: inspection.checkedPaths,
          missingPaths: inspection.missingPaths,
        },
      });
    }
  }

  private async inspectPm2Processes(
    context: UpdateStepExecutionContext,
    step: 'restart_services' | 'healthcheck' | 'post_validation',
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
      const category =
        step === 'restart_services'
          ? 'UPDATE_RESTART_FAILED'
          : step === 'healthcheck'
            ? 'UPDATE_HEALTHCHECK_FAILED'
            : 'UPDATE_POST_DEPLOY_VALIDATION_FAILED';
      throw new UpdateRuntimeStepError({
        code: 'UPDATE_PM2_JLIST_INVALID',
        category,
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
    options: {
      backendName: string;
      frontendName: string;
      baseDir: string;
      expectedBackendDir: string;
      expectedFrontendDir: string;
    },
  ): NativePm2StatusEvidence {
    const backendCandidates: NativePm2ProcessEvidence[] = [];
    const frontendCandidates: NativePm2ProcessEvidence[] = [];
    const exactEntries = new Map<string, Record<string, unknown>>();

    for (const entry of processes) {
      const processName = String(entry.name || '').trim();
      if (processName) {
        exactEntries.set(processName, entry);
      }

      const role = this.detectPm2ProcessRole(entry, options.baseDir);
      if (role === 'backend') {
        backendCandidates.push(this.toPm2ProcessEvidence(entry, options.expectedBackendDir));
      } else if (role === 'frontend') {
        frontendCandidates.push(this.toPm2ProcessEvidence(entry, options.expectedFrontendDir));
      }
    }

    const resolveProcess = (name: string, expectedDir: string) =>
      this.toPm2ProcessEvidence(exactEntries.get(name) || null, expectedDir, name);

    return {
      backend: resolveProcess(options.backendName, options.expectedBackendDir),
      frontend: resolveProcess(options.frontendName, options.expectedFrontendDir),
      backendConflicts: backendCandidates.filter(
        (candidate) => candidate.processName !== options.backendName && candidate.online,
      ),
      frontendConflicts: frontendCandidates.filter(
        (candidate) => candidate.processName !== options.frontendName && candidate.online,
      ),
    };
  }

  private collectConflictingPm2ProcessNames(
    processes: Array<Record<string, unknown>>,
    options: {
      backendName: string;
      frontendName: string;
      baseDir: string;
      expectedBackendDir: string;
      expectedFrontendDir: string;
    },
  ): string[] {
    const evidence = this.collectPm2Evidence(processes, options);
    return Array.from(
      new Set([
        ...evidence.backendConflicts.map((process) => process.processName),
        ...evidence.frontendConflicts.map((process) => process.processName),
      ]),
    );
  }

  private resolvePm2ProcessNames(context: UpdateStepExecutionContext): {
    backendName: string;
    frontendName: string;
    source: 'metadata' | 'environment' | 'runtime_default' | 'mixed';
  } {
    const metadataBackendName = this.getMetadataString(context.metadata, 'pm2BackendName');
    const metadataFrontendName = this.getMetadataString(context.metadata, 'pm2FrontendName');
    const envBackendName = String(process.env.PM2_BACKEND_NAME || '').trim() || null;
    const envFrontendName = String(process.env.PM2_FRONTEND_NAME || '').trim() || null;
    const runtimeDefaultNames = this.buildDefaultPm2ProcessNames(context.runtime.baseDir);

    const backendName = metadataBackendName || envBackendName || runtimeDefaultNames.backendName;
    const frontendName = metadataFrontendName || envFrontendName || runtimeDefaultNames.frontendName;

    if (metadataBackendName || metadataFrontendName) {
      return {
        backendName,
        frontendName,
        source: metadataBackendName && metadataFrontendName ? 'metadata' : 'mixed',
      };
    }

    if (envBackendName || envFrontendName) {
      return {
        backendName,
        frontendName,
        source: envBackendName && envFrontendName ? 'environment' : 'mixed',
      };
    }

    return {
      backendName,
      frontendName,
      source: 'runtime_default',
    };
  }

  private buildDefaultPm2ProcessNames(baseDir: string): { backendName: string; frontendName: string } {
    const instanceName =
      String(path.basename(path.resolve(baseDir)) || '')
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'multitenant';

    return {
      backendName: `${instanceName}-backend`,
      frontendName: `${instanceName}-frontend`,
    };
  }

  private detectPm2ProcessRole(
    entry: Record<string, unknown>,
    baseDir: string,
  ): 'backend' | 'frontend' | null {
    const evidence = this.toPm2ProcessEvidence(entry, null);
    const comparableBaseDir = this.normalizeComparablePath(baseDir);
    const comparableCwd = this.normalizeComparablePath(evidence.cwd);
    const comparableExecPath = this.normalizeComparablePath(evidence.execPath);
    const comparableArgs = evidence.args.map((value) => this.normalizeComparablePath(value));
    const name = evidence.processName.toLowerCase();

    const belongsToBaseDir =
      this.isPathInsideComparableBase(comparableCwd, comparableBaseDir) ||
      this.isPathInsideComparableBase(comparableExecPath, comparableBaseDir);
    if (!belongsToBaseDir) {
      return null;
    }

    const backendSignal =
      name.includes('backend') ||
      comparableCwd.includes('/apps/backend') ||
      comparableExecPath.includes('/apps/backend') ||
      comparableExecPath.endsWith('/dist/main.js') ||
      comparableArgs.some((value) => value.includes('/apps/backend') || value.endsWith('/dist/main.js'));

    const frontendSignal =
      name.includes('frontend') ||
      comparableCwd.includes('/apps/frontend') ||
      comparableExecPath.includes('/apps/frontend') ||
      comparableExecPath.endsWith('/scripts/start-standalone.mjs') ||
      comparableExecPath.includes('/.next/standalone/') ||
      comparableArgs.some(
        (value) =>
          value.includes('/apps/frontend') ||
          value.endsWith('/scripts/start-standalone.mjs') ||
          value.includes('/.next/standalone/'),
      );

    if (backendSignal && !frontendSignal) {
      return 'backend';
    }

    if (frontendSignal && !backendSignal) {
      return 'frontend';
    }

    if (backendSignal) {
      return 'backend';
    }

    if (frontendSignal) {
      return 'frontend';
    }

    return null;
  }

  private toPm2ProcessEvidence(
    entry: Record<string, unknown> | null,
    expectedReleaseDir: string | null,
    fallbackName?: string,
  ): NativePm2ProcessEvidence {
    const pm2Env =
      entry && typeof entry.pm2_env === 'object' && entry.pm2_env !== null
        ? (entry.pm2_env as Record<string, unknown>)
        : {};
    const processName = fallbackName || String(entry?.name || '').trim();
    const rawArgs = entry?.args ?? pm2Env.args ?? [];
    const args = Array.isArray(rawArgs)
      ? rawArgs.map((value) => String(value))
      : typeof rawArgs === 'string' && rawArgs.trim()
        ? rawArgs
            .split(/\s+/)
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
    const status = String(pm2Env.status || 'missing');
    const cwd = this.pickFirstString(entry, ['pm_cwd', 'cwd']) || this.pickFirstString(pm2Env, ['pm_cwd', 'cwd']);
    const execPath =
      this.pickFirstString(entry, ['pm_exec_path', 'exec_path']) ||
      this.pickFirstString(pm2Env, ['pm_exec_path', 'exec_path']) ||
      null;
    const port =
      this.pickFirstNumber(pm2Env.env as Record<string, unknown> | undefined, ['PORT', 'port']) ??
      this.pickFirstNumber(pm2Env, ['PORT', 'port']) ??
      this.pickFirstNumber(entry, ['PORT', 'port']);

    return {
      processName,
      found: Boolean(entry),
      status,
      pmId: this.pickFirstNumber(pm2Env, ['pm_id']) ?? this.pickFirstNumber(entry, ['pm_id']) ?? -1,
      online: status === 'online',
      cwd,
      execPath,
      args,
      port,
      pointsToExpectedRelease: expectedReleaseDir
        ? this.pm2ProcessPointsToExpectedRelease({ cwd, execPath, args }, expectedReleaseDir)
        : null,
    };
  }

  private pm2ProcessPointsToExpectedRelease(
    process: {
      cwd: string | null;
      execPath: string | null;
      args: string[];
    },
    expectedReleaseDir: string,
  ): boolean {
    const comparableExpectedDir = this.normalizeComparablePath(expectedReleaseDir);
    const comparableCwd = this.normalizeComparablePath(process.cwd);
    const comparableExecPath = this.normalizeComparablePath(process.execPath);

    if (comparableCwd && this.isSameComparablePath(comparableCwd, comparableExpectedDir)) {
      return true;
    }

    if (comparableExecPath && this.isPathInsideComparableBase(comparableExecPath, comparableExpectedDir)) {
      return true;
    }

    return process.args.some((value) =>
      this.isPathInsideComparableBase(this.normalizeComparablePath(value), comparableExpectedDir),
    );
  }

  private async validateLiveRuntimeIdentity(
    context: UpdateStepExecutionContext,
    stage: 'healthcheck' | 'post_validation',
    backendPort: number,
    expectedVersion: string,
  ): Promise<Record<string, unknown>> {
    const systemVersionUrl = `http://127.0.0.1:${backendPort}/api/system/version`;
    const updateStatusUrl = `http://127.0.0.1:${backendPort}/api/update/status`;
    const systemVersion = await this.fetchJsonResponse(systemVersionUrl, 'versao do sistema em runtime');
    const updateStatus = await this.fetchJsonResponse(updateStatusUrl, 'status do update em runtime');
    const category =
      stage === 'healthcheck' ? 'UPDATE_HEALTHCHECK_FAILED' : 'UPDATE_POST_DEPLOY_VALIDATION_FAILED';

    if (
      !this.versionMatchesTarget(
        expectedVersion,
        this.getRecordString(systemVersion, 'installedVersionRaw') || this.getRecordString(systemVersion, 'version'),
        this.getRecordString(systemVersion, 'installedBaseTag'),
        this.getRecordString(systemVersion, 'installedVersionNormalized'),
      )
    ) {
      throw new UpdateRuntimeStepError({
        code:
          stage === 'healthcheck'
            ? 'UPDATE_HEALTHCHECK_RUNTIME_VERSION_MISMATCH'
            : 'UPDATE_POST_DEPLOY_RUNTIME_VERSION_MISMATCH',
        category,
        stage,
        userMessage: 'A release servida em runtime nao corresponde a versao alvo do update.',
        technicalMessage:
          `systemVersion=${JSON.stringify(systemVersion)} expected=${expectedVersion}; ` +
          `updateStatus=${JSON.stringify(updateStatus)}`,
        retryable: false,
        rollbackEligible: true,
        details: {
          expectedVersion,
          systemVersion,
          updateStatus,
        },
      });
    }

    if (
      !this.versionMatchesTarget(
        expectedVersion,
        this.getRecordString(updateStatus, 'installedVersionRaw') || this.getRecordString(updateStatus, 'currentVersion'),
        this.getRecordString(updateStatus, 'installedBaseTag'),
        this.getRecordString(updateStatus, 'installedVersionNormalized'),
      )
    ) {
      throw new UpdateRuntimeStepError({
        code:
          stage === 'healthcheck'
            ? 'UPDATE_HEALTHCHECK_UPDATE_STATUS_MISMATCH'
            : 'UPDATE_POST_DEPLOY_UPDATE_STATUS_MISMATCH',
        category,
        stage,
        userMessage: 'O status operacional ainda indica uma versao diferente da release publicada.',
        technicalMessage: `updateStatus=${JSON.stringify(updateStatus)} expected=${expectedVersion}`,
        retryable: false,
        rollbackEligible: true,
        details: {
          expectedVersion,
          systemVersion,
          updateStatus,
        },
      });
    }

    const availableVersion = this.getRecordString(updateStatus, 'availableVersion');
    const updateAvailable = updateStatus.updateAvailable === true;
    if (updateAvailable && availableVersion && this.versionMatchesTarget(expectedVersion, availableVersion, null, null)) {
      throw new UpdateRuntimeStepError({
        code:
          stage === 'healthcheck'
            ? 'UPDATE_HEALTHCHECK_TARGET_STILL_AVAILABLE'
            : 'UPDATE_POST_DEPLOY_TARGET_STILL_AVAILABLE',
        category,
        stage,
        userMessage: 'A release publicada ainda aparece como atualizacao pendente no runtime.',
        technicalMessage: `availableVersion=${availableVersion}; expected=${expectedVersion}`,
        retryable: false,
        rollbackEligible: true,
        details: {
          expectedVersion,
          systemVersion,
          updateStatus,
        },
      });
    }

    return {
      systemVersion,
      updateStatus,
    };
  }

  private async fetchJsonResponse(url: string, label: string): Promise<Record<string, unknown>> {
    const body = await this.assertHttpOk(url, label);

    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      throw new Error(`${label} retornou JSON invalido em ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private versionMatchesTarget(
    targetVersion: string,
    rawVersion: string | null,
    baseTag: string | null,
    normalizedVersion: string | null,
  ): boolean {
    const expected = this.normalizeComparableVersion(targetVersion);
    const candidates = [rawVersion, baseTag, normalizedVersion]
      .map((value) => this.normalizeComparableVersion(value))
      .filter((value): value is string => Boolean(value));

    return candidates.includes(expected);
  }

  private normalizeComparableVersion(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .replace(/^v/i, '')
      .replace(/\+.*$/, '');
  }

  private pickFirstString(record: Record<string, unknown> | null | undefined, keys: string[]): string | null {
    if (!record) {
      return null;
    }

    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private getRecordString(record: Record<string, unknown>, key: string): string | null {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private pickFirstNumber(record: Record<string, unknown> | null | undefined, keys: string[]): number | null {
    if (!record) {
      return null;
    }

    for (const key of keys) {
      const parsed = Number(record[key]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  private normalizeComparablePath(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/\/+$/, '')
      .toLowerCase();
  }

  private isSameComparablePath(left: string, right: string): boolean {
    return this.normalizeComparablePath(left) === this.normalizeComparablePath(right);
  }

  private isPathInsideComparableBase(candidate: string, baseDir: string): boolean {
    if (!candidate || !baseDir) {
      return false;
    }

    return candidate === baseDir || candidate.startsWith(`${baseDir}/`);
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

