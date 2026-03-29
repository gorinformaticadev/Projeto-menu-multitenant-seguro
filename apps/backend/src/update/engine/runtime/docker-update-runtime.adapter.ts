import { Injectable } from '@nestjs/common';
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
  type UpdateRollbackExecutionResult,
  type UpdateRuntimeAdapter,
  type UpdateRuntimeAdapterDescriptor,
  type UpdateRuntimeExecutionStrategy,
  type UpdateStepExecutionContext,
  type UpdateStepExecutionResult,
} from './update-runtime-adapter.interface';

@Injectable()
export class DockerUpdateRuntimeAdapter implements UpdateRuntimeAdapter {
  readonly mode = 'docker' as const;

  constructor(
    private readonly commandRunner: UpdateCommandRunnerService,
    private readonly probeService: UpdateHttpProbeService,
  ) {}

  describe(): UpdateRuntimeAdapterDescriptor {
    return {
      mode: this.mode,
      executionStrategy: this.resolveExecutionStrategy(),
      supportsRollback: true,
      restartStrategy: 'docker_compose_recreate',
      healthcheckStrategy: 'container_and_http_probes',
      plannedSteps: getExecutionPlanForMode(this.mode),
    };
  }

  async executeStep(
    step: UpdateStepCode,
    context: UpdateStepExecutionContext,
  ): Promise<UpdateStepExecutionResult> {
    switch (step) {
      case 'pull_images':
        return await this.pullImages(context);
      case 'install_dependencies':
        return {
          status: 'skipped',
          result: {
            reason: 'immutable_container_images',
          },
        };
      case 'build_backend':
        return await this.validatePulledImage(context, 'backend', 'build_backend');
      case 'build_frontend':
        return await this.validatePulledImage(context, 'frontend', 'build_frontend');
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
        throw new Error(`Etapa ${step} nao suportada pelo adapter docker.`);
    }
  }

  async executeRollback(
    context: UpdateStepExecutionContext,
    error: UpdateExecutionErrorSnapshot,
  ): Promise<UpdateRollbackExecutionResult> {
    const frontendImage = this.getMetadataString(context.metadata, 'currentFrontendImageRef');
    const backendImage = this.getMetadataString(context.metadata, 'currentBackendImageRef');
    if (!frontendImage || !backendImage) {
      throw new Error('Rollback docker indisponivel: imagens anteriores nao capturadas.');
    }

    const overrideFile = await this.writeComposeOverride(context, {
      frontendImage,
      backendImage,
      label: 'rollback',
    });

    await this.runCompose(
      context,
      'rollback',
      [...this.composeFileArgs(context), '-f', overrideFile, 'up', '-d', '--no-deps', '--force-recreate', 'frontend', 'backend'],
    );
    const healthResult = await this.performHealthcheck(context);
    const validationResult = await this.performFrontendValidation(context);

    return {
      result: {
        frontendImage,
        backendImage,
        overrideFile,
        rollbackErrorCode: error.code,
        healthcheck: healthResult,
        validation: validationResult,
      },
      metadata: {
        activeComposeOverride: overrideFile,
        targetFrontendImageRef: frontendImage,
        targetBackendImageRef: backendImage,
      },
    };
  }

  private async pullImages(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const currentFrontend = await this.captureServiceImageSnapshot(context, 'frontend');
    const currentBackend = await this.captureServiceImageSnapshot(context, 'backend');

    await this.runCompose(context, 'pull_images', [...this.composeFileArgs(context), 'pull', 'frontend', 'backend']);

    return {
      result: {
        pulled: ['frontend', 'backend'],
      },
      metadata: {
        currentFrontendImageRef: currentFrontend.configImage || currentFrontend.imageId || null,
        currentFrontendImageId: currentFrontend.imageId || null,
        currentBackendImageRef: currentBackend.configImage || currentBackend.imageId || null,
        currentBackendImageId: currentBackend.imageId || null,
      },
    };
  }

  private async validatePulledImage(
    context: UpdateStepExecutionContext,
    service: 'frontend' | 'backend',
    step: 'build_backend' | 'build_frontend',
  ): Promise<UpdateStepExecutionResult> {
    const imageRef = await this.resolveTargetServiceImage(context, service);
    const inspect = await this.runCommandOrThrow(
      context,
      step,
      'docker',
      ['image', 'inspect', imageRef],
      context.runtime.baseDir,
    );

    return {
      result: {
        service,
        imageRef,
        inspected: inspect.stdout.length > 0,
      },
      metadata:
        service === 'frontend'
          ? {
              targetFrontendImageRef: imageRef,
            }
          : {
              targetBackendImageRef: imageRef,
            },
    };
  }

  private async migrate(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const services = await this.listComposeServices(context);
    if (!services.includes('migrate')) {
      return {
        status: 'skipped',
        result: {
          reason: 'migrate_service_not_defined',
        },
      };
    }

    await this.runCompose(context, 'migrate', [...this.composeFileArgs(context), 'run', '--rm', 'migrate']);
    return {
      result: {
        service: 'migrate',
      },
    };
  }

  private async seed(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    await this.runCompose(context, 'seed', [
      ...this.composeFileArgs(context),
      'run',
      '--rm',
      'backend',
      'node',
      'dist/prisma/seed.js',
      'deploy',
    ]);

    return {
      result: {
        service: 'backend',
      },
    };
  }

  private async preSwitchValidation(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const services = await this.listComposeServices(context);
    for (const requiredService of ['frontend', 'backend']) {
      if (!services.includes(requiredService)) {
        throw new Error(`Servico ${requiredService} nao encontrado no compose.`);
      }
    }

    const frontendImage = await this.resolveTargetServiceImage(context, 'frontend');
    const backendImage = await this.resolveTargetServiceImage(context, 'backend');

    return {
      result: {
        services,
        frontendImage,
        backendImage,
      },
      metadata: {
        targetFrontendImageRef: frontendImage,
        targetBackendImageRef: backendImage,
      },
    };
  }

  private async switchRelease(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const frontendImage = this.requireMetadataString(context.metadata, 'targetFrontendImageRef');
    const backendImage = this.requireMetadataString(context.metadata, 'targetBackendImageRef');
    const overrideFile = await this.writeComposeOverride(context, {
      frontendImage,
      backendImage,
      label: 'target',
    });

    return {
      result: {
        overrideFile,
        frontendImage,
        backendImage,
      },
      metadata: {
        activeComposeOverride: overrideFile,
      },
    };
  }

  private async restartServices(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const overrideFile = this.requireMetadataString(context.metadata, 'activeComposeOverride');
    await this.runCompose(context, 'restart_services', [
      ...this.composeFileArgs(context),
      '-f',
      overrideFile,
      'up',
      '-d',
      '--no-deps',
      '--force-recreate',
      'frontend',
      'backend',
    ]);

    return {
      result: {
        overrideFile,
      },
    };
  }

  private async healthcheck(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    return {
      result: await this.performHealthcheck(context),
    };
  }

  private async postValidation(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    return {
      result: await this.performFrontendValidation(context),
    };
  }

  private async cleanup(context: UpdateStepExecutionContext): Promise<UpdateStepExecutionResult> {
    const overrideRoot = path.join(context.runtime.sharedDir, 'update-engine', 'compose-overrides');
    const entries = await fsp.readdir(overrideRoot, { withFileTypes: true }).catch(() => []);
    const currentOverride = this.getMetadataString(context.metadata, 'activeComposeOverride');
    const removed: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const fullPath = path.join(overrideRoot, entry.name);
      if (fullPath === currentOverride) {
        continue;
      }

      const stat = await fsp.stat(fullPath).catch(() => null);
      if (!stat) {
        continue;
      }

      if (Date.now() - stat.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
        await fsp.rm(fullPath, { force: true });
        removed.push(fullPath);
      }
    }

    return {
      result: {
        removedOverrides: removed,
      },
    };
  }

  private resolveExecutionStrategy(): UpdateRuntimeExecutionStrategy {
    return process.env.UPDATE_DOCKER_EXECUTION_STRATEGY === 'legacy_bridge'
      ? 'legacy_bridge'
      : 'native_agent';
  }

  private composeFileArgs(context: UpdateStepExecutionContext): string[] {
    const composeFile = this.resolvePathFromMetadataOrEnv(
      context,
      'composeFile',
      process.env.COMPOSE_FILE || 'docker-compose.prod.yml',
    );
    const envFile = this.resolvePathFromMetadataOrEnv(
      context,
      'envFile',
      process.env.ENV_FILE || 'install/.env.production',
    );

    return ['compose', '--env-file', envFile, '-f', composeFile];
  }

  private resolvePathFromMetadataOrEnv(
    context: UpdateStepExecutionContext,
    metadataKey: string,
    fallback: string,
  ): string {
    const rawValue = this.getMetadataString(context.metadata, metadataKey) || fallback;
    return path.isAbsolute(rawValue) ? rawValue : path.join(context.runtime.baseDir, rawValue);
  }

  private async runCompose(
    context: UpdateStepExecutionContext,
    step: string,
    args: string[],
  ) {
    const result = await this.runCommandOrThrow(context, step, 'docker', args, context.runtime.baseDir);
    return result;
  }

  private async listComposeServices(context: UpdateStepExecutionContext): Promise<string[]> {
    const result = await this.runCompose(context, 'pre_switch_validation', [
      ...this.composeFileArgs(context),
      'config',
      '--services',
    ]);

    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private async resolveTargetServiceImage(
    context: UpdateStepExecutionContext,
    service: 'frontend' | 'backend',
  ): Promise<string> {
    const config = await this.runCompose(context, 'pre_switch_validation', [
      ...this.composeFileArgs(context),
      'config',
    ]);

    const imageRef = this.extractServiceImageFromConfig(config.stdout, service);
    if (!imageRef) {
      throw new Error(`Imagem do servico ${service} nao encontrada no compose config.`);
    }

    return imageRef;
  }

  private extractServiceImageFromConfig(configText: string, service: string): string | null {
    const lines = configText.split(/\r?\n/);
    let inBlock = false;

    for (const line of lines) {
      if (new RegExp(`^\\s{2}${service}:\\s*$`).test(line)) {
        inBlock = true;
        continue;
      }

      if (inBlock && /^\s{2}[A-Za-z0-9_-]+:\s*$/.test(line)) {
        break;
      }

      if (inBlock) {
        const match = line.match(/^\s{4}image:\s*(.+)\s*$/);
        if (match) {
          return match[1].replace(/^['"]|['"]$/g, '');
        }
      }
    }

    return null;
  }

  private async captureServiceImageSnapshot(
    context: UpdateStepExecutionContext,
    service: 'frontend' | 'backend',
  ): Promise<{
    containerId: string | null;
    imageId: string | null;
    configImage: string | null;
  }> {
    const ps = await this.runCompose(context, 'pull_images', [
      ...this.composeFileArgs(context),
      'ps',
      '-q',
      service,
    ]);
    const containerId = ps.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || null;
    if (!containerId) {
      return {
        containerId: null,
        imageId: null,
        configImage: null,
      };
    }

    const imageId = await this.inspectDockerValue(context, 'pull_images', [
      'inspect',
      '--format',
      '{{.Image}}',
      containerId,
    ]);
    const configImage = await this.inspectDockerValue(context, 'pull_images', [
      'inspect',
      '--format',
      '{{.Config.Image}}',
      containerId,
    ]);

    return {
      containerId,
      imageId,
      configImage,
    };
  }

  private async inspectDockerValue(
    context: UpdateStepExecutionContext,
    step: string,
    args: string[],
  ): Promise<string | null> {
    const result = await this.runCommandOrThrow(context, step, 'docker', args, context.runtime.baseDir);
    const value = result.stdout.trim();
    return value || null;
  }

  private async writeComposeOverride(
    context: UpdateStepExecutionContext,
    params: {
      frontendImage: string;
      backendImage: string;
      label: string;
    },
  ): Promise<string> {
    const overrideRoot = path.join(context.runtime.sharedDir, 'update-engine', 'compose-overrides');
    await fsp.mkdir(overrideRoot, { recursive: true });
    const filePath = path.join(
      overrideRoot,
      `${context.execution.id}-${params.label}.override.yml`,
    );
    const content = [
      'services:',
      '  frontend:',
      `    image: ${params.frontendImage}`,
      '  backend:',
      `    image: ${params.backendImage}`,
      '',
    ].join('\n');

    await fsp.writeFile(filePath, content, 'utf8');
    await this.commandRunner.recordInternalOperation({
      executionId: context.execution.id,
      step: 'switch_release',
      command: 'internal:write_compose_override',
      args: [filePath],
      cwd: context.runtime.baseDir,
      logDir: context.runtime.logsDir,
      metadata: {
        frontendImage: params.frontendImage,
        backendImage: params.backendImage,
      },
    });

    return filePath;
  }

  private async performHealthcheck(context: UpdateStepExecutionContext): Promise<Record<string, unknown>> {
    const frontendContainerId = await this.resolveCurrentContainerId(context, 'frontend');
    const backendContainerId = await this.resolveCurrentContainerId(context, 'backend');
    if (!frontendContainerId || !backendContainerId) {
      throw new Error('Containers frontend/backend nao encontrados apos restart.');
    }

    await this.waitForContainerHealthy(context, 'frontend', frontendContainerId);
    await this.waitForContainerHealthy(context, 'backend', backendContainerId);

    const backendUrl = `http://127.0.0.1:${Number(process.env.PORT || 4000)}/api/health`;
    const frontendUrl = `http://127.0.0.1:${Number(process.env.FRONTEND_PORT || 5000)}/api/health`;
    await this.probeService.waitForReady({
      url: backendUrl,
      timeoutMs: Number(process.env.UPDATE_LIVE_HEALTH_TIMEOUT_MS || 120_000),
    });
    await this.probeService.waitForReady({
      url: frontendUrl,
      timeoutMs: Number(process.env.UPDATE_LIVE_HEALTH_TIMEOUT_MS || 120_000),
    });

    return {
      backendContainerId,
      frontendContainerId,
      backendUrl,
      frontendUrl,
    };
  }

  private async performFrontendValidation(context: UpdateStepExecutionContext): Promise<Record<string, unknown>> {
    const frontendPort = Number(process.env.FRONTEND_PORT || 5000);
    const backendPort = Number(process.env.PORT || 4000);
    const rootHtml = await this.assertHttpOk(`http://127.0.0.1:${frontendPort}/`, 'rota / do frontend');
    const loginHtml = await this.assertHttpOk(`http://127.0.0.1:${frontendPort}/login`, 'rota /login do frontend');
    const staticAsset = this.extractStaticAssetPath(loginHtml) || this.extractStaticAssetPath(rootHtml);
    if (!staticAsset) {
      throw new Error('Nenhum asset estatico foi localizado no frontend docker.');
    }

    await this.assertHttpOk(`http://127.0.0.1:${backendPort}/api/health`, 'healthcheck backend docker');
    await this.assertHttpOk(`http://127.0.0.1:${frontendPort}/api/health`, 'healthcheck frontend docker');
    await this.assertHttpOk(`http://127.0.0.1:${frontendPort}${staticAsset}`, `asset estatico ${staticAsset}`);

    return {
      staticAsset,
      frontendPort,
      backendPort,
    };
  }

  private async waitForContainerHealthy(
    context: UpdateStepExecutionContext,
    service: 'frontend' | 'backend',
    containerId: string,
  ): Promise<void> {
    const startedAt = Date.now();
    const timeoutMs = Number(process.env.UPDATE_DOCKER_HEALTH_TIMEOUT_MS || 120_000);

    while (Date.now() - startedAt < timeoutMs) {
      const healthStatus = await this.inspectDockerValue(context, 'healthcheck', [
        'inspect',
        '--format',
        '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}',
        containerId,
      ]);

      if (healthStatus === 'healthy') {
        return;
      }

      if (healthStatus === 'unhealthy' || healthStatus === 'no-healthcheck') {
        throw new Error(`Servico ${service} em estado invalido: ${healthStatus}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }

    throw new Error(`Timeout aguardando healthcheck do servico ${service}.`);
  }

  private async resolveCurrentContainerId(
    context: UpdateStepExecutionContext,
    service: 'frontend' | 'backend',
  ): Promise<string | null> {
    const result = await this.runCompose(context, 'healthcheck', [
      ...this.composeFileArgs(context),
      'ps',
      '-q',
      service,
    ]);

    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || null;
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

  private async runCommandOrThrow(
    context: UpdateStepExecutionContext,
    step: string,
    command: string,
    args: string[],
    cwd: string,
  ) {
    const result = await this.commandRunner.run({
      executionId: context.execution.id,
      step,
      command,
      args,
      cwd,
      logDir: context.runtime.logsDir,
    });

    if (result.exitCode !== 0) {
      throw new Error(
        `${command} ${args.join(' ')} falhou com exitCode=${result.exitCode}. ${result.stderr || result.stdout}`.trim(),
      );
    }

    return result;
  }

  private getMetadataString(metadata: UpdateExecutionMetadata, key: string): string | null {
    const value = metadata?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private requireMetadataString(metadata: UpdateExecutionMetadata, key: string): string {
    const value = this.getMetadataString(metadata, key);
    if (!value) {
      throw new Error(`Metadata obrigatoria ausente: ${key}`);
    }
    return value;
  }
}
