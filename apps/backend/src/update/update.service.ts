import { Injectable, Logger, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExecuteUpdateDto, UpdateConfigDto, UpdateStatusDto } from './dto/update.dto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as semver from 'semver';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { Prisma, UpdateLog, UpdateSystemSettings } from '@prisma/client';
import { SystemVersionService } from '@common/services/system-version.service';
import { SystemUpdateAdminService } from './system-update-admin.service';
import { OperationalCircuitBreakerService } from '@common/services/operational-circuit-breaker.service';
import { OperationalLoadSheddingService } from '@common/services/operational-load-shedding.service';

type UpdateExecutionResult = { stdout: string; stderr: string };
type UpdateLogListItem = Pick<
  UpdateLog,
  'id' | 'version' | 'status' | 'startedAt' | 'completedAt' | 'duration' | 'packageManager' | 'errorMessage' | 'rollbackReason' | 'executedBy'
>;
type UpdateExecutionStatus = 'starting' | 'completed';
type UpdateLifecycleStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not_available'
  | 'pending_confirmation'
  | 'starting'
  | 'running'
  | 'restarting_services'
  | 'completed'
  | 'failed';
type UpdateExecutionError = Error & {
  stdout?: string;
  stderr?: string;
  status?: number;
  code?: number | string;
  exitCode?: number;
};

type SystemUpdateStateSnapshot = {
  status: 'idle' | 'running' | 'success' | 'failed' | 'rolled_back';
  mode: 'docker' | 'native';
  startedAt: string | null;
  finishedAt: string | null;
  fromVersion: string;
  toVersion: string;
  step: string;
  progress: number;
  lock: boolean;
  lastError: string | null;
  errorCode: string | null;
  errorCategory: string | null;
  errorStage: string | null;
  exitCode: number | null;
  userMessage: string | null;
  technicalMessage: string | null;
  rollback: {
    attempted: boolean;
    completed: boolean;
    reason: string | null;
  };
  operation: {
    active: boolean;
    operationId: string | null;
    type: 'update' | 'rollback' | null;
  };
  stale?: boolean;
};

type StructuredUpdateErrorPayload = {
  message: string;
  code: string;
  category: string;
  stage: string;
  userMessage: string;
  technicalMessage: string;
  operationId: string | null;
  updateLogId: string | null;
  exitCode: number | null;
};

@Injectable()
export class UpdateService implements OnModuleInit {
  private readonly logger = new Logger(UpdateService.name);
  private readonly encryptionKeyRaw = process.env.ENCRYPTION_KEY || '';
  private readonly encryptionKey: Buffer;
  private readonly execFileAsync = promisify(execFile);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private readonly systemVersionService: SystemVersionService,
    private readonly systemUpdateAdminService: SystemUpdateAdminService,
    private readonly operationalCircuitBreakerService: OperationalCircuitBreakerService,
    private readonly operationalLoadSheddingService: OperationalLoadSheddingService,
  ) {
    this.encryptionKey = this.resolveEncryptionKey();
  }

  async onModuleInit() {
    await this.syncSystemVersionWithFilesystem();
  }

  private async syncSystemVersionWithFilesystem() {
    try {
      const realVersion = this.getRuntimeVersionInfo().version;
      const settings = await this.getSystemSettings();

      if (settings.appVersion !== realVersion) {
        this.logger.log(`Sincronizando versão: Banco(${settings.appVersion}) -> Arquivos(${realVersion})`);
        await this.updateSystemSettings({
          appVersion: realVersion,
          updateAvailable: false,
        });
      }
    } catch (error) {
      this.logger.error('Falha ao sincronizar versão do sistema no startup:', error);
    }
  }

  async checkForUpdates(): Promise<{ updateAvailable: boolean; availableVersion?: string }> {
    let decryptedTokenForSanitizer = '';
    try {
      this.logger.log('Iniciando verificação de atualizações...');
      const settings = await this.getSystemSettings();
      const loadShedding = this.operationalLoadSheddingService.getSnapshot();

      if (!settings.gitUsername || !settings.gitRepository) {
        this.logger.warn('Configurações do Git não encontradas');
        return { updateAvailable: false };
      }

      if (loadShedding.mitigation.disableRemoteUpdateChecks) {
        this.logger.warn(
          `Verificacao remota de atualizacoes mitigada automaticamente. factor=${loadShedding.adaptiveThrottleFactor} cause=${loadShedding.pressureCause}`,
        );
        return {
          updateAvailable: Boolean(settings.updateAvailable),
          availableVersion: settings.availableVersion || undefined,
        };
      }

      const repoUrl = this.buildPublicGitRepoUrl(settings);
      decryptedTokenForSanitizer = this.tryDecryptToken(settings.gitToken);
      const stdout = await this.operationalCircuitBreakerService.execute(
        {
          key: 'dependency:github-remote-tags',
          route: '/update/check',
          failureThreshold: 2,
          failureWindowMs: 15_000,
          resetTimeoutMs: 60_000,
          halfOpenMaxProbes: 1,
          halfOpenSuccessThreshold: 1,
          jitterRatio: 0.15,
        },
        () => this.getRemoteTagsOutput(repoUrl, settings.gitToken),
      );

      const cleanTags = stdout
        .split('\n')
        .map(line => line.split('\t')[1])
        .filter(ref => ref && ref.includes('refs/tags/'))
        .map(ref => ref.replace('refs/tags/', '').replace('^{}', ''))
        .map(tag => semver.clean(tag))
        .filter((tag): tag is string => !!tag && !!semver.valid(tag));

      const uniqueCleanTags = Array.from(new Set(cleanTags)).sort((a, b) => semver.rcompare(a, b));

      if (uniqueCleanTags.length === 0) {
        this.logger.warn('Nenhuma tag válida encontrada no repositório');
        return { updateAvailable: false };
      }

      const latestClean = uniqueCleanTags[0];
      const latestVersion = this.formatVersion(latestClean);
      const currentClean = this.getComparableVersion(this.getRuntimeVersionInfo().version);
      const updateAvailable = semver.gt(latestClean, currentClean);

      await this.updateSystemSettings({
        availableVersion: latestVersion,
        updateAvailable,
        lastUpdateCheck: new Date(),
      });

      return { updateAvailable, availableVersion: latestVersion };
    } catch (error: unknown) {
      const parsedError = this.asUpdateExecutionError(error);
      const detail = this.sanitizeGitError(
        String(parsedError.stderr || parsedError.message || ''),
        decryptedTokenForSanitizer,
      );
      this.logger.error(`Erro ao verificar atualizações. detalhe=${detail}`);
      throw new HttpException('Erro ao verificar atualizações', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async executeUpdate(
    updateData: ExecuteUpdateDto,
    executedBy: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; logId: string; operationId?: string; status: UpdateExecutionStatus; message: string }> {
    let updateLog: UpdateLog | null = null;
    const normalizedCleanVersion = semver.clean(updateData.version);
    if (!normalizedCleanVersion) {
      throw new HttpException(
        {
          message: 'Versao invalida',
          code: 'UPDATE_UNEXPECTED_ERROR',
          category: 'UPDATE_UNEXPECTED_ERROR',
          stage: 'validation',
          userMessage: 'Versao invalida. Informe uma versao semver valida.',
          technicalMessage: `version=${String(updateData.version || '')}`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    const normalizedVersion = this.formatVersion(normalizedCleanVersion);
    const mode = this.getInstallationMode();
    const startedAtIso = new Date().toISOString();

    try {
      await this.reconcileRunningUpdateLogWithSystemState();

      const runningUpdate = await this.prisma.updateLog.findFirst({
        where: { status: 'STARTED' },
        orderBy: { startedAt: 'asc' },
      });

      if (runningUpdate) {
        throw new HttpException(
          {
            message: 'Ja existe uma atualizacao em andamento',
            code: 'UPDATE_CONFLICT_ERROR',
            category: 'UPDATE_UNEXPECTED_ERROR',
            stage: 'lock',
            userMessage: 'Ja existe uma atualizacao em andamento. Aguarde a conclusao para iniciar outra.',
            technicalMessage: `updateLogId=${runningUpdate.id}`,
            updateLogId: runningUpdate.id,
          },
          HttpStatus.CONFLICT,
        );
      }

      const currentVersion = this.getComparableVersion(this.getRuntimeVersionInfo().version);
      if (!semver.gt(normalizedCleanVersion, currentVersion)) {
        updateLog = await this.prisma.updateLog.create({
          data: {
            version: normalizedVersion,
            status: 'SUCCESS',
            packageManager: mode,
            executedBy,
            ipAddress,
            userAgent,
            completedAt: new Date(),
            duration: 0,
            executionLogs: JSON.stringify({
              idempotent: true,
              message: `Versao ${normalizedVersion} ja aplicada (atual: ${currentVersion})`,
              version: normalizedVersion,
              currentVersion,
              mode,
            }),
          },
        });

        await this.auditService.log({
          action: 'UPDATE_SKIPPED',
          userId: executedBy,
          tenantId: null,
          ipAddress,
          userAgent,
          details: { version: normalizedVersion, currentVersion, reason: 'idempotent-skip', mode },
        });

        return {
          success: true,
          logId: updateLog.id,
          status: 'completed',
          message: `Versao ${normalizedVersion} ja aplicada. Nenhum redeploy executado.`,
        };
      }

      updateLog = await this.prisma.updateLog.create({
        data: {
          version: normalizedVersion,
          status: 'STARTED',
          packageManager: mode,
          executedBy,
          ipAddress,
          userAgent,
          executionLogs: JSON.stringify({
            mode,
            phase: 'starting',
            step: 'api-triggered',
            requestedVersion: normalizedVersion,
            startedAt: startedAtIso,
            operationId: null,
          }),
        },
      });

      const startResult = await this.systemUpdateAdminService.runUpdate({
        version: normalizedVersion,
        userId: executedBy,
        ipAddress,
        userAgent,
      });

      await this.prisma.updateLog.update({
        where: { id: updateLog.id },
        data: {
          executionLogs: JSON.stringify({
            mode,
            phase: 'running',
            step: 'job-started',
            requestedVersion: normalizedVersion,
            startedAt: startedAtIso,
            operationId: startResult.operationId,
          }),
        },
      });

      await this.auditService.log({
        action: 'UPDATE_STARTED',
        userId: executedBy,
        tenantId: null,
        ipAddress,
        userAgent,
        details: { version: normalizedVersion, logId: updateLog.id, operationId: startResult.operationId, mode },
      });

      return {
        success: true,
        logId: updateLog.id,
        operationId: startResult.operationId,
        status: 'starting',
        message: startResult.message || `Atualizacao para ${normalizedVersion} iniciada.`,
      };
    } catch (error: unknown) {
      const mappedError = this.mapExecuteStartError(error, {
        updateLogId: updateLog?.id || null,
        requestedVersion: normalizedVersion,
        operationId: null,
      });

      if (updateLog) {
        const startedAt = updateLog.startedAt ? new Date(updateLog.startedAt).getTime() : Date.now();
        const duration = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
        await this.prisma.updateLog.update({
          where: { id: updateLog.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            duration,
            errorMessage: mappedError.userMessage,
            rollbackReason:
              mappedError.code === 'UPDATE_RESTART_ERROR' || mappedError.code === 'UPDATE_PM2_ERROR'
                ? 'automatic rollback executed'
                : undefined,
            executionLogs: JSON.stringify({
              mode,
              phase: 'failed',
              step: mappedError.stage,
              requestedVersion: normalizedVersion,
              startedAt: startedAtIso,
              operationId: null,
              error: mappedError,
            }),
          },
        });

        await this.auditService.log({
          action: 'UPDATE_FAILED',
          userId: executedBy,
          tenantId: null,
          ipAddress,
          userAgent,
          details: {
            version: normalizedVersion,
            error: mappedError.technicalMessage,
            code: mappedError.code,
            category: mappedError.category,
            stage: mappedError.stage,
            logId: updateLog.id,
          },
        });
      }

      throw new HttpException(
        {
          message: mappedError.userMessage,
          code: mappedError.code,
          category: mappedError.category,
          stage: mappedError.stage,
          userMessage: mappedError.userMessage,
          technicalMessage: mappedError.technicalMessage,
          operationId: mappedError.operationId,
          updateLogId: mappedError.updateLogId,
          exitCode: mappedError.exitCode,
        },
        mappedError.httpStatus,
      );
    }
  }

  async getUpdateStatus(): Promise<UpdateStatusDto> {
    const settings = await this.getSystemSettings();
    const systemState = await this.safeGetSystemUpdateState();
    await this.reconcileRunningUpdateLogWithSystemState(systemState);
    const lifecycle = this.buildLifecycleState(settings, systemState);
    const runtimeVersion = this.getRuntimeVersionInfo().version;

    const mode = systemState?.mode || this.getInstallationMode();
    return {
      currentVersion: this.formatVersion(runtimeVersion),
      availableVersion: settings.availableVersion ? this.formatVersion(settings.availableVersion) : undefined,
      updateAvailable: settings.updateAvailable || false,
      lastCheck: settings.lastUpdateCheck || undefined,
      isConfigured: !!(settings.gitUsername && settings.gitRepository),
      checkEnabled: settings.updateCheckEnabled || false,
      mode,
      updateLifecycle: lifecycle,
    };
  }

  async getUpdateConfig(): Promise<{
    gitUsername: string;
    gitRepository: string;
    gitReleaseBranch: string;
    packageManager: string;
    updateCheckEnabled: boolean;
    hasGitToken: boolean;
  }> {
    const settings = await this.getSystemSettings();
    return {
      gitUsername: settings.gitUsername || '',
      gitRepository: settings.gitRepository || '',
      gitReleaseBranch: settings.gitReleaseBranch || 'main',
      packageManager: settings.packageManager || 'docker',
      updateCheckEnabled: settings.updateCheckEnabled ?? true,
      hasGitToken: !!settings.gitToken,
    };
  }

  async updateConfig(config: UpdateConfigDto, updatedBy: string): Promise<{ success: boolean; message: string }> {
    try {
      const updateData: Prisma.UpdateSystemSettingsUncheckedUpdateInput = { updatedBy };

      if (typeof config.gitUsername === 'string') {
        updateData.gitUsername = config.gitUsername;
      }
      if (typeof config.gitRepository === 'string') {
        updateData.gitRepository = config.gitRepository;
      }
      if (typeof config.gitReleaseBranch === 'string') {
        updateData.gitReleaseBranch = config.gitReleaseBranch;
      }
      if (typeof config.packageManager === 'string') {
        updateData.packageManager = config.packageManager;
      }
      if (typeof config.updateCheckEnabled === 'boolean') {
        updateData.updateCheckEnabled = config.updateCheckEnabled;
      }

      if (typeof config.gitToken === 'string' && config.gitToken.trim().length > 0) {
        updateData.gitToken = this.encryptToken(config.gitToken);
      }

      if (config.releaseTag) {
        const normalized = semver.clean(config.releaseTag);
        if (!normalized) {
          throw new HttpException('releaseTag inválida', HttpStatus.BAD_REQUEST);
        }
        updateData.releaseTag = this.formatVersion(normalized);
      }

      if (config.composeFile) {
        updateData.composeFile = config.composeFile;
      }

      if (config.envFile) {
        updateData.envFile = config.envFile;
      }

      await this.updateSystemSettings(updateData);

      await this.auditService.log({
        action: 'UPDATE_CONFIG_CHANGED',
        userId: updatedBy,
        tenantId: null,
        details: { configFields: Object.keys(config) },
      });

      return { success: true, message: 'Configurações atualizadas com sucesso' };
    } catch (error) {
      this.logger.error('Erro ao atualizar configurações:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Erro ao atualizar configurações', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getUpdateLogs(limit: number = 50): Promise<UpdateLogListItem[]> {
    return this.prisma.updateLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        version: true,
        status: true,
        startedAt: true,
        completedAt: true,
        duration: true,
        packageManager: true,
        errorMessage: true,
        rollbackReason: true,
        executedBy: true,
      },
    });
  }

  async getUpdateLogDetails(logId: string): Promise<UpdateLog> {
    const log = await this.prisma.updateLog.findUnique({ where: { id: logId } });
    if (!log) {
      throw new HttpException('Log não encontrado', HttpStatus.NOT_FOUND);
    }
    return log;
  }

  private async safeGetSystemUpdateState(): Promise<SystemUpdateStateSnapshot | null> {
    try {
      const state = await this.systemUpdateAdminService.getStatus();
      return state as SystemUpdateStateSnapshot;
    } catch (error) {
      this.logger.warn(`Falha ao obter status do update admin: ${String(error)}`);
      return null;
    }
  }

  private async reconcileRunningUpdateLogWithSystemState(
    preloadedSystemState?: SystemUpdateStateSnapshot | null,
  ): Promise<void> {
    const runningLogs = await this.prisma.updateLog.findMany({
      where: { status: 'STARTED' },
      orderBy: { startedAt: 'asc' },
      take: 5,
    });
    if (runningLogs.length === 0) {
      return;
    }

    const systemState = preloadedSystemState ?? (await this.safeGetSystemUpdateState());
    if (!systemState) {
      return;
    }

    const stillRunning =
      systemState.status === 'running' ||
      systemState.lock === true ||
      systemState.operation?.active === true;

    if (stillRunning) {
      return;
    }

    const normalizedFinalStatus = this.mapSystemStateToUpdateLogStatus(systemState.status);
    if (!normalizedFinalStatus) {
      return;
    }

    const completedAt = systemState.finishedAt ? new Date(systemState.finishedAt) : new Date();
    const completedAtSafe = Number.isFinite(completedAt.getTime()) ? completedAt : new Date();

    for (const log of runningLogs) {
      const startedAtMs = new Date(log.startedAt).getTime();
      const completedAtMs = completedAtSafe.getTime();
      const duration = Number.isFinite(startedAtMs) && completedAtMs >= startedAtMs
        ? Math.floor((completedAtMs - startedAtMs) / 1000)
        : null;

      const executionLog = this.parseExecutionLogs(log.executionLogs);
      const mergedExecutionLog = {
        ...executionLog,
        reconciled: true,
        reconciledAt: new Date().toISOString(),
        finalState: {
          status: systemState.status,
          mode: systemState.mode,
          step: systemState.step,
          progress: systemState.progress,
          finishedAt: systemState.finishedAt,
          operation: systemState.operation,
          stale: Boolean(systemState.stale),
          errorCode: systemState.errorCode,
          errorCategory: systemState.errorCategory,
          errorStage: systemState.errorStage,
          exitCode: systemState.exitCode,
          userMessage: systemState.userMessage,
          technicalMessage: systemState.technicalMessage,
          rollback: systemState.rollback,
        },
      };

      await this.prisma.updateLog.update({
        where: { id: log.id },
        data: {
          status: normalizedFinalStatus,
          completedAt: completedAtSafe,
          duration: duration ?? undefined,
          errorMessage: systemState.userMessage || systemState.lastError || undefined,
          rollbackReason:
            normalizedFinalStatus === 'ROLLED_BACK'
              ? systemState.rollback?.reason || 'automatic rollback executed'
              : undefined,
          executionLogs: JSON.stringify(mergedExecutionLog),
        },
      });
    }

    if (normalizedFinalStatus === 'SUCCESS' && systemState.toVersion && systemState.toVersion !== 'unknown') {
      await this.updateSystemSettings({
        appVersion: this.formatVersion(systemState.toVersion),
        releaseTag: this.formatVersion(systemState.toVersion),
        updateAvailable: false,
      });
    }
  }

  private mapSystemStateToUpdateLogStatus(status: SystemUpdateStateSnapshot['status']): string | null {
    if (status === 'success') {
      return 'SUCCESS';
    }
    if (status === 'failed') {
      return 'FAILED';
    }
    if (status === 'rolled_back') {
      return 'ROLLED_BACK';
    }
    return null;
  }

  private buildLifecycleState(
    settings: UpdateSystemSettings,
    systemState: SystemUpdateStateSnapshot | null,
  ): UpdateStatusDto['updateLifecycle'] {
    const rawStatus = systemState?.status || 'idle';
    const step = systemState?.step || 'idle';
    const progress = Number.isFinite(Number(systemState?.progress)) ? Number(systemState?.progress) : 0;
    const hasStructuredError = Boolean(
      systemState?.errorCode || systemState?.errorCategory || systemState?.errorStage || systemState?.lastError,
    );

    const lifecycleStatus = this.resolveLifecycleStatus(settings, systemState);

    return {
      status: lifecycleStatus,
      availabilityStatus: settings.updateAvailable ? 'available' : 'not_available',
      rawStatus,
      step,
      progress: progress < 0 ? 0 : progress > 100 ? 100 : Math.floor(progress),
      startedAt: systemState?.startedAt || null,
      finishedAt: systemState?.finishedAt || null,
      mode: systemState?.mode || this.getInstallationMode(),
      lock: Boolean(systemState?.lock),
      stale: Boolean(systemState?.stale),
      operation: {
        active: Boolean(systemState?.operation?.active),
        operationId: systemState?.operation?.operationId || null,
        type: systemState?.operation?.type || null,
      },
      rollback: {
        attempted: Boolean(systemState?.rollback?.attempted),
        completed: Boolean(systemState?.rollback?.completed),
        reason: systemState?.rollback?.reason || null,
      },
      error: hasStructuredError
        ? {
            code: systemState?.errorCode || 'UPDATE_UNEXPECTED_ERROR',
            category: systemState?.errorCategory || 'UPDATE_UNEXPECTED_ERROR',
            stage: systemState?.errorStage || step || 'unknown',
            userMessage: systemState?.userMessage || 'Falha durante atualizacao.',
            technicalMessage: systemState?.technicalMessage || systemState?.lastError || null,
            exitCode: systemState?.exitCode ?? null,
          }
        : null,
    };
  }

  private resolveLifecycleStatus(
    settings: UpdateSystemSettings,
    systemState: SystemUpdateStateSnapshot | null,
  ): UpdateLifecycleStatus {
    const step = String(systemState?.step || '').trim().toLowerCase();
    const running =
      systemState?.status === 'running' ||
      systemState?.lock === true ||
      systemState?.operation?.active === true;

    if (running) {
      if (this.isRestartingStep(step)) {
        return 'restarting_services';
      }
      if (this.isStartingStep(step)) {
        return 'starting';
      }
      return 'running';
    }

    if (systemState?.status === 'success') {
      return 'completed';
    }

    if (systemState?.status === 'failed' || systemState?.status === 'rolled_back') {
      return 'failed';
    }

    if (settings.updateAvailable) {
      return 'pending_confirmation';
    }

    if (settings.lastUpdateCheck) {
      return 'not_available';
    }

    return 'idle';
  }

  private isStartingStep(step: string): boolean {
    return /^(starting|init|prepare|precheck|backup|download|checkout|build|migrate|seed)/i.test(step);
  }

  private isRestartingStep(step: string): boolean {
    return /(restart|health|swap|switch|rollback|pm2|systemd|container|compose)/i.test(step);
  }

  private parseExecutionLogs(raw: string | null | undefined): Record<string, unknown> {
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return { raw };
    }
  }

  private mapExecuteStartError(
    error: unknown,
    context: {
      updateLogId: string | null;
      requestedVersion: string;
      operationId: string | null;
    },
  ): StructuredUpdateErrorPayload & { httpStatus: number } {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      const status = this.normalizeHttpStatus(error.getStatus(), HttpStatus.INTERNAL_SERVER_ERROR);
      const responseObj =
        typeof response === 'string'
          ? ({ message: response } as Record<string, unknown>)
          : ((response || {}) as Record<string, unknown>);
      const message = String(responseObj.message || responseObj.userMessage || 'Falha ao iniciar atualizacao');
      const technicalMessage = String(
        responseObj.technicalMessage ||
          responseObj.detail ||
          responseObj.error ||
          `HttpException status=${status}`,
      );
      return {
        message,
        code: String(responseObj.code || 'UPDATE_UNEXPECTED_ERROR'),
        category: String(responseObj.category || 'UPDATE_UNEXPECTED_ERROR'),
        stage: String(responseObj.stage || 'starting'),
        userMessage: String(responseObj.userMessage || message),
        technicalMessage,
        operationId: (responseObj.operationId as string) || context.operationId,
        updateLogId: (responseObj.updateLogId as string) || context.updateLogId,
        exitCode: Number.isFinite(Number(responseObj.exitCode)) ? Number(responseObj.exitCode) : null,
        httpStatus: status,
      };
    }

    const rawObject = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
    const parsedError = this.asUpdateExecutionError(error);
    const rawStatus = Number(rawObject.status ?? (parsedError as { status?: unknown }).status);
    const httpStatus = this.normalizeHttpStatus(
      Number.isFinite(rawStatus) ? rawStatus : HttpStatus.INTERNAL_SERVER_ERROR,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    const technicalMessage = this.sanitizeGitError(
      String(parsedError.stderr || parsedError.message || 'Erro desconhecido ao iniciar update'),
    );
    const technicalNormalized = technicalMessage.toLowerCase();

    let code = 'UPDATE_UNEXPECTED_ERROR';
    let category = 'UPDATE_UNEXPECTED_ERROR';
    let stage = 'starting';
    let userMessage = 'Falha inesperada ao iniciar a atualizacao.';

    if (/timeout|timed out|etimedout/.test(technicalNormalized)) {
      code = 'UPDATE_TIMEOUT';
      category = 'UPDATE_TIMEOUT';
      stage = 'timeout';
      userMessage = 'A inicializacao da atualizacao excedeu o tempo limite.';
    } else if (/github|rate limit|eai_again|enotfound|network|fetch/i.test(technicalNormalized)) {
      code = 'UPDATE_NETWORK_ERROR';
      category = 'UPDATE_NETWORK_ERROR';
      stage = 'github';
      userMessage = 'Falha de rede ao consultar origem de atualizacao.';
    } else if (/permission denied|eacces|operation not permitted/.test(technicalNormalized)) {
      code = 'UPDATE_SCRIPT_ERROR';
      category = 'UPDATE_SCRIPT_ERROR';
      stage = 'permissions';
      userMessage = 'Falha de permissao para iniciar o processo de atualizacao.';
    }

    return {
      message: userMessage,
      code,
      category,
      stage,
      userMessage,
      technicalMessage,
      operationId: context.operationId,
      updateLogId: context.updateLogId,
      exitCode: Number.isFinite(Number(rawObject.exitCode ?? rawObject.code ?? parsedError.exitCode ?? parsedError.code))
        ? Number(rawObject.exitCode ?? rawObject.code ?? parsedError.exitCode ?? parsedError.code)
        : null,
      httpStatus,
    };
  }

  private normalizeHttpStatus(statusLike: unknown, fallback: number = HttpStatus.INTERNAL_SERVER_ERROR): number {
    const status = Number(statusLike);
    if (Number.isInteger(status) && status >= 100 && status <= 599) {
      return status;
    }
    return fallback;
  }
  private async getSystemSettings(): Promise<UpdateSystemSettings> {
    let settings = await this.prisma.updateSystemSettings.findFirst();

    if (!settings) {
      settings = await this.prisma.updateSystemSettings.create({
        data: {
          appVersion: this.getRuntimeVersionInfo().version,
          packageManager: 'docker',
          updateCheckEnabled: true,
          gitReleaseBranch: 'main',
          releaseTag: 'latest',
          composeFile: 'docker-compose.prod.yml',
          envFile: 'install/.env.production',
        },
      });
    }

    return settings;
  }

  private async updateSystemSettings(data: Prisma.UpdateSystemSettingsUncheckedUpdateInput): Promise<void> {
    const settings = await this.getSystemSettings();
    await this.prisma.updateSystemSettings.update({
      where: { id: settings.id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  private async runSafeImageDeploy(version: string, settings: UpdateSystemSettings): Promise<UpdateExecutionResult> {
    const root = this.getProjectRoot();
    const scriptPath = path.join(root, 'install', 'update-images.sh');
    if (!fs.existsSync(scriptPath)) {
      throw new HttpException('Runner de deploy não encontrado (install/update-images.sh)', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const composeFile = settings.composeFile || 'docker-compose.prod.yml';
    const envFile = settings.envFile || 'install/.env.production';

    const allowedCompose = new Set(['docker-compose.prod.yml', 'docker-compose.prod.external.yml']);
    const allowedEnv = new Set(['install/.env.production', '.env.production', '.env']);

    if (!allowedCompose.has(composeFile)) {
      throw new HttpException('composeFile não permitido para deploy', HttpStatus.BAD_REQUEST);
    }
    if (!allowedEnv.has(envFile)) {
      throw new HttpException('envFile não permitido para deploy', HttpStatus.BAD_REQUEST);
    }

    const env = {
      ...process.env,
      PROJECT_ROOT: root,
      RELEASE_TAG: version,
      COMPOSE_FILE: composeFile,
      ENV_FILE: envFile,
      HEALTH_TIMEOUT: process.env.UPDATE_HEALTH_TIMEOUT || '120',
    };

    return this.execFileAsync('bash', [path.join('install', 'update-images.sh')], {
      cwd: root,
      env,
      timeout: 30 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024,
    });
  }

  private async runSafeNativeDeploy(version: string, settings: UpdateSystemSettings): Promise<UpdateExecutionResult> {
    const root = this.getProjectRoot();
    const scriptPath = path.join(root, 'install', 'update-native.sh');
    if (!fs.existsSync(scriptPath)) {
      throw new HttpException('Runner de deploy nativo não encontrado (install/update-native.sh)', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const hasRepoConfig = !!(settings.gitUsername && settings.gitRepository);
    const decryptedToken = hasRepoConfig ? this.tryDecryptToken(settings.gitToken) : '';
    const basicAuth = decryptedToken
      ? Buffer.from(`x-access-token:${decryptedToken}`, 'utf8').toString('base64')
      : '';

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PROJECT_ROOT: root,
      RELEASE_TAG: version,
    };
    if (hasRepoConfig) {
      env.GIT_REPO_URL = this.buildPublicGitRepoUrl(settings);
    }
    if (basicAuth) {
      env.GIT_AUTH_HEADER = `AUTHORIZATION: basic ${basicAuth}`;
    }

    return this.execFileAsync('bash', [path.join('install', 'update-native.sh')], {
      cwd: root,
      env,
      timeout: 45 * 60 * 1000, // Native build can take longer
      maxBuffer: 50 * 1024 * 1024,
    });
  }

  private getInstallationMode(): 'docker' | 'native' {
    try {
      if (process.env.IS_DOCKER === 'true') {
        return 'docker';
      }

      if (fs.existsSync('/.dockerenv')) {
        return 'docker';
      }

      const cgroupPath = '/proc/1/cgroup';
      if (fs.existsSync(cgroupPath)) {
        const cgroup = fs.readFileSync(cgroupPath, 'utf8');
        if (/docker|containerd|kubepods/i.test(cgroup)) {
          return 'docker';
        }
      }
    } catch (error) {
      this.logger.warn(`Falha ao detectar modo de instalação automaticamente: ${String(error)}`);
    }

    return 'native';
  }

  private getProjectRoot(): string {
    const cwd = process.cwd();
    const candidates = [
      cwd,
      path.resolve(cwd, '..'), // if in apps/backend or similar
      path.resolve(cwd, '..', '..'), // if in apps/backend/dist
      path.resolve(__dirname, '..', '..', '..'), // src/update -> src -> apps/backend -> root
      path.resolve(__dirname, '..', '..', '..', '..'), // dist/src/update -> ... -> root
    ];

    for (const root of candidates) {
      if (fs.existsSync(path.join(root, 'install'))) {
        return root;
      }
    }
    return cwd;
  }

  private encryptToken(token: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
  }

  private decryptToken(encryptedToken: string): string {
    const parts = encryptedToken.split(':');
    if (parts.length === 3) {
      const [ivHex, encryptedHex, tagHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const encrypted = Buffer.from(encryptedHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    }

    return this.decryptTokenLegacyCbc(encryptedToken);
  }

  private resolveEncryptionKey(): Buffer {
    const isProd = process.env.NODE_ENV === 'production';
    const key = this.encryptionKeyRaw;
    const isWeak = !key || key.length < 32 || key === 'default-key-change-in-production';

    if (isProd && isWeak) {
      throw new Error('ENCRYPTION_KEY ausente ou fraca para ambiente de produção');
    }

    if (isWeak) {
      this.logger.warn('ENCRYPTION_KEY fraca/ausente fora de produção. Usando derivação temporária.');
    }

    const source = key || 'development-only-insecure-key';
    return crypto.createHash('sha256').update(source, 'utf8').digest();
  }

  private decryptTokenLegacyCbc(encryptedToken: string): string {
    const [ivHex, encrypted] = encryptedToken.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Token criptografado inválido');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const legacyKeyRaw = (this.encryptionKeyRaw || 'development-only-insecure-key').slice(0, 32).padEnd(32, '0');
    const legacyKey = Buffer.from(legacyKeyRaw, 'utf8');
    const decipher = crypto.createDecipheriv('aes-256-cbc', legacyKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private formatVersion(version: string): string {
    const value = String(version || '').trim();
    if (!value) {
      return 'unknown';
    }
    if (value.startsWith('v')) {
      return value;
    }
    if (semver.valid(value)) {
      return `v${value}`;
    }
    return value;
  }

  private getRuntimeVersionInfo() {
    return this.systemVersionService.getVersionInfo();
  }

  private getComparableVersion(version: string): string {
    const value = String(version || '').trim();
    if (!value) {
      return '0.0.0';
    }

    const valid = semver.valid(value);
    if (valid) {
      return valid;
    }

    const clean = semver.clean(value);
    if (clean) {
      return clean;
    }

    const coerced = semver.coerce(value);
    return coerced?.version || '0.0.0';
  }

  private buildPublicGitRepoUrl(settings: UpdateSystemSettings): string {
    const repository = String(settings.gitRepository || '').replace(/\.git$/i, '');
    return `https://github.com/${settings.gitUsername}/${repository}.git`;
  }

  private async getRemoteTagsOutput(repoUrl: string, encryptedGitToken?: string): Promise<string> {
    const options = { timeout: 60_000, cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 };
    if (!encryptedGitToken) {
      const { stdout } = await this.execFileAsync('git', ['ls-remote', '--tags', repoUrl], options);
      return stdout;
    }

    let decryptedToken = '';
    try {
      decryptedToken = this.tryDecryptToken(encryptedGitToken);
      if (!decryptedToken) {
        const { stdout } = await this.execFileAsync('git', ['ls-remote', '--tags', repoUrl], options);
        return stdout;
      }

      const basicAuth = Buffer.from(`x-access-token:${decryptedToken}`, 'utf8').toString('base64');
      const headerArg = `http.extraHeader=AUTHORIZATION: basic ${basicAuth}`;
      const { stdout } = await this.execFileAsync(
        'git',
        ['-c', headerArg, 'ls-remote', '--tags', repoUrl],
        options,
      );
      return stdout;
    } catch (error: unknown) {
      const parsedError = this.asUpdateExecutionError(error);
      const sanitizedStderr = this.sanitizeGitError(
        String(parsedError.stderr || parsedError.message || ''),
        decryptedToken,
      );
      this.logger.warn(`Falha ao usar gitToken; tentando repositório sem autenticação. detalhe=${sanitizedStderr}`);
      const { stdout } = await this.execFileAsync('git', ['ls-remote', '--tags', repoUrl], options);
      return stdout;
    }
  }

  private tryDecryptToken(encryptedGitToken?: string): string {
    if (!encryptedGitToken) return '';
    try {
      return this.decryptToken(encryptedGitToken);
    } catch {
      return '';
    }
  }

  private sanitizeGitError(output: string, token?: string): string {
    if (!output) return '';
    let sanitized = output;

    sanitized = sanitized.replace(
      /AUTHORIZATION:\s*basic\s+[A-Za-z0-9+/=]{20,}/gi,
      'AUTHORIZATION: basic [REDACTED]',
    );
    sanitized = sanitized.replace(
      /(AUTHORIZATION:\s*basic\s+)[A-Za-z0-9+/=]{8,}/gi,
      '$1[REDACTED]',
    );

    if (token) {
      const basicAuth = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
      const secrets = [token, basicAuth, `x-access-token:${token}`];

      for (const secret of secrets) {
        if (secret) {
          sanitized = sanitized.split(secret).join('[REDACTED]');
        }
      }
    }
    return sanitized;
  }

  private asUpdateExecutionError(error: unknown): UpdateExecutionError {
    if (error instanceof Error) {
      return error as UpdateExecutionError;
    }

    return new Error(String(error)) as UpdateExecutionError;
  }
}
