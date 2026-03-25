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

type UpdateExecutionResult = { stdout: string; stderr: string };
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
  private updateSystemSettingsColumnsCache: Set<string> | null = null;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private readonly systemVersionService: SystemVersionService,
    private readonly systemUpdateAdminService: SystemUpdateAdminService,
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

      if (!settings.gitUsername || !settings.gitRepository) {
        this.logger.warn('Configurações do Git não encontradas');
        return { updateAvailable: false };
      }

      const repoUrl = this.buildPublicGitRepoUrl(settings);
      decryptedTokenForSanitizer = this.tryDecryptToken(settings.gitToken);
      const stdout = await this.getRemoteTagsOutput(repoUrl, settings.gitToken, settings.gitReleaseBranch);

      const cleanTags = stdout
        .split('\n')
        .map(line => line.split('\t')[1])
        .filter(ref => ref && ref.includes('refs/tags/'))
        .map(ref => ref.replace('refs/tags/', '').replace('^{}', ''))
        .map(tag => semver.clean(tag))
        .filter((tag): tag is string => !!tag && !!semver.valid(tag));

      const currentClean = this.getComparableVersion(this.getRuntimeVersionInfo().version);
      const uniqueCleanTags = this.selectCandidateReleaseTags(cleanTags, currentClean);

      if (uniqueCleanTags.length === 0) {
        this.logger.warn('Nenhuma tag válida encontrada no repositório');
        return { updateAvailable: false };
      }

      const latestClean = uniqueCleanTags[0];
      const latestVersion = this.formatVersion(latestClean);
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

  async testConnection(config?: UpdateConfigDto): Promise<{ connected: boolean; updateAvailable: boolean; availableVersion?: string }> {
    let decryptedTokenForSanitizer = '';
    try {
      const settings = await this.getSystemSettings();
      const providedToken = config?.gitToken?.trim();
      const mergedSettings = {
        ...settings,
        gitUsername: config?.gitUsername || settings.gitUsername,
        gitRepository: config?.gitRepository || settings.gitRepository,
        gitReleaseBranch: config?.gitReleaseBranch || settings.gitReleaseBranch,
        gitToken: providedToken ? this.encryptToken(providedToken) : settings.gitToken,
      } as UpdateSystemSettings;

      if (!mergedSettings.gitUsername || !mergedSettings.gitRepository) {
        return { connected: false, updateAvailable: false };
      }

      const repoUrl = this.buildPublicGitRepoUrl(mergedSettings);
      decryptedTokenForSanitizer = providedToken || this.tryDecryptToken(mergedSettings.gitToken);
      const stdout = await this.getRemoteTagsOutput(repoUrl, mergedSettings.gitToken, mergedSettings.gitReleaseBranch);

      const cleanTags = stdout
        .split('\n')
        .map(line => line.split('\t')[1])
        .filter(ref => ref && ref.includes('refs/tags/'))
        .map(ref => ref.replace('refs/tags/', '').replace('^{}', ''))
        .map(tag => semver.clean(tag))
        .filter((tag): tag is string => !!tag && !!semver.valid(tag));

      const currentClean = this.getComparableVersion(this.getRuntimeVersionInfo().version);
      const uniqueCleanTags = this.selectCandidateReleaseTags(cleanTags, currentClean);
      if (uniqueCleanTags.length === 0) {
        return { connected: true, updateAvailable: false };
      }

      const latestClean = uniqueCleanTags[0];
      const latestVersion = this.formatVersion(latestClean);

      return {
        connected: true,
        updateAvailable: semver.gt(latestClean, currentClean),
        availableVersion: latestVersion,
      };
    } catch (error: unknown) {
      const parsedError = this.asUpdateExecutionError(error);
      const detail = this.sanitizeGitError(
        String(parsedError.stderr || parsedError.message || ''),
        decryptedTokenForSanitizer,
      );
      this.logger.warn(`Falha no teste de conexão do repositório. detalhe=${detail}`);
      return { connected: false, updateAvailable: false };
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
    const settings = await this.getSystemSettings();
    const mode = this.getInstallationMode(settings);
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

      // Preparar variáveis de ambiente para o processo de atualização
      const decryptedToken = this.tryDecryptToken(settings.gitToken);
      const env: Record<string, string> = {
        GIT_REPO_URL: this.buildPublicGitRepoUrl(settings),
        UPDATE_CHANNEL: settings.updateChannel,
      };

      if (decryptedToken) {
        // Formato para git: http.extraHeader=AUTHORIZATION: Bearer <TOKEN>
        env.GIT_AUTH_HEADER = `http.extraHeader=AUTHORIZATION: Bearer ${decryptedToken}`;
      }

      const startResult = await this.systemUpdateAdminService.runUpdate({
        version: normalizedVersion,
        userId: executedBy,
        ipAddress,
        userAgent,
        env, // Passar env customizado para o admin service
      } as any);

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
        details: { version: normalizedVersion, currentVersion, mode, operationId: startResult.operationId },
      });

      return {
        success: true,
        logId: updateLog.id,
        operationId: startResult.operationId,
        status: 'starting',
        message: `Processo de atualizacao para ${normalizedVersion} iniciado com sucesso.`,
      };
    } catch (error: unknown) {
      const context = {
        updateLogId: updateLog?.id || null,
        requestedVersion: normalizedVersion,
        operationId: null,
      };
      const structuredError = this.mapExecuteStartError(error, context);

      if (updateLog) {
        await this.prisma.updateLog.update({
          where: { id: updateLog.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            duration: 0,
            errorMessage: structuredError.userMessage,
            executionLogs: JSON.stringify({
              ...structuredError,
              phase: 'failed',
              step: 'start-error',
              finishedAt: new Date().toISOString(),
            }),
          },
        });
      }

      throw new HttpException(structuredError, structuredError.httpStatus);
    }
  }

  async getUpdateStatus(): Promise<UpdateStatusDto> {
    await this.reconcileRunningUpdateLogWithSystemState();
    const settings = await this.getSystemSettings();
    const systemState = await this.safeGetSystemUpdateState();
    const runtime = this.getRuntimeVersionInfo();

    return {
      currentVersion: runtime.version,
      availableVersion: settings.availableVersion || undefined,
      updateAvailable: settings.updateAvailable,
      lastCheck: settings.lastUpdateCheck || undefined,
      isConfigured: !!(settings.gitUsername && settings.gitRepository),
      checkEnabled: settings.updateCheckEnabled,
      mode: this.getInstallationMode(settings),
      updateChannel: settings.updateChannel as any,
      updateLifecycle: this.buildLifecycleState(settings, systemState),
    };
  }

  async getUpdateConfig(): Promise<UpdateConfigDto> {
    const settings = await this.getSystemSettings();
    return {
      gitUsername: settings.gitUsername || undefined,
      gitRepository: settings.gitRepository || undefined,
      gitToken: settings.gitToken ? '********' : undefined,
      gitReleaseBranch: settings.gitReleaseBranch || 'main',
      packageManager: settings.packageManager || 'docker',
      updateChannel: settings.updateChannel as any,
      updateCheckEnabled: settings.updateCheckEnabled,
      releaseTag: settings.releaseTag || undefined,
      composeFile: settings.composeFile || 'docker-compose.prod.yml',
      envFile: settings.envFile || 'install/.env.production',
    };
  }

  async updateConfig(data: UpdateConfigDto, userId: string): Promise<void> {
    const current = await this.getSystemSettings();
    const updateData: Prisma.UpdateSystemSettingsUncheckedUpdateInput = {
      gitUsername: data.gitUsername,
      gitRepository: data.gitRepository,
      gitReleaseBranch: data.gitReleaseBranch,
      packageManager: data.packageManager,
      updateCheckEnabled: data.updateCheckEnabled,
      updateChannel: data.updateChannel,
      releaseTag: data.releaseTag,
      composeFile: data.composeFile,
      envFile: data.envFile,
      updatedBy: userId,
    };

    if (data.gitToken && data.gitToken !== '********') {
      updateData.gitToken = this.encryptToken(data.gitToken);
    }

    try {
      await this.updateSystemSettings(updateData);
    } catch (error) {
      this.logger.error(`Falha ao salvar configuracoes de update: ${String(error)}`);
      throw new HttpException(
        {
          message: 'Erro ao persistir configuracoes no banco de dados',
          technical: String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    await this.auditService.log({
      action: 'UPDATE_CONFIG_CHANGED',
      userId,
      tenantId: null,
      details: {
        from: {
          gitUsername: current.gitUsername,
          gitRepository: current.gitRepository,
          packageManager: current.packageManager,
          updateChannel: current.updateChannel,
        },
        to: {
          gitUsername: data.gitUsername,
          gitRepository: data.gitRepository,
          packageManager: data.packageManager,
          updateChannel: data.updateChannel,
        },
      },
    });
  }

  async getUpdateLogs(limit: number = 20): Promise<UpdateLog[]> {
    return this.prisma.updateLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  async getUpdateLogDetail(id: string): Promise<UpdateLog> {
    const log = await this.prisma.updateLog.findUnique({ where: { id } });
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
    const staleRecovery = !normalizedFinalStatus && this.shouldRecoverStaleRunningLogs(systemState);
    if (!normalizedFinalStatus && !staleRecovery) {
      return;
    }

    const finalStatus = normalizedFinalStatus || 'FAILED';
    const recoveredErrorMessage =
      staleRecovery
        ? 'Update anterior ficou sem processo ativo e foi destravado automaticamente.'
        : systemState.userMessage || systemState.lastError || undefined;

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
        staleRecovered: staleRecovery,
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
          status: finalStatus,
          completedAt: completedAtSafe,
          duration: duration ?? undefined,
          errorMessage: recoveredErrorMessage,
          rollbackReason:
            finalStatus === 'ROLLED_BACK'
              ? systemState.rollback?.reason || 'automatic rollback executed'
              : undefined,
          executionLogs: JSON.stringify(mergedExecutionLog),
        },
      });
    }

    if (finalStatus === 'SUCCESS' && systemState.toVersion && systemState.toVersion !== 'unknown') {
      await this.updateSystemSettings({
        appVersion: this.formatVersion(systemState.toVersion),
        releaseTag: this.formatVersion(systemState.toVersion),
        updateAvailable: false,
      });
    }
  }

  private shouldRecoverStaleRunningLogs(systemState: SystemUpdateStateSnapshot): boolean {
    return (
      systemState.status === 'idle' &&
      systemState.lock !== true &&
      systemState.operation?.active !== true
    );
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
      mode: systemState?.mode || this.getInstallationMode(settings),
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
    return /^(starting|init|prepare|precheck|backup|download|checkout|install|build|package|validate frontend artifact|pre swap|migrate|seed)/i.test(step);
  }

  private isRestartingStep(step: string): boolean {
    return /(restart|health|swap|switch|publish|rollback|pm2|post deploy|validation|systemd|container|compose)/i.test(step);
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
    const rawStatus = Number(parsedError.status || rawObject.status || rawObject.httpStatus);
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
    try {
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
        this.logger.warn('Detectada inconsistência no schema do banco (colunas ausentes). Tentando fallback seguro.');
        const rawSettings = await this.fetchRawUpdateSystemSettings();
        if (rawSettings) {
          return this.normalizeRawUpdateSystemSettings(rawSettings);
        }

        return this.createLegacyDefaultSystemSettings();
      }
      throw error;
    }
  }

  private async updateSystemSettings(data: Prisma.UpdateSystemSettingsUncheckedUpdateInput): Promise<void> {
    const settings = await this.getSystemSettings();
    try {
      await this.prisma.updateSystemSettings.update({
        where: { id: settings.id },
        data: { ...data, updatedAt: new Date() },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
        this.logger.warn('Falha ao salvar devido a colunas ausentes no banco. Aplicando fallback SQL compatível com schema legado.');
        await this.updateSystemSettingsWithRawSql(settings.id, data);
        return;
      }
      throw error;
    }
  }

  private async fetchRawUpdateSystemSettings(): Promise<Record<string, unknown> | null> {
    const rawSettings = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM "update_system_settings" LIMIT 1',
    );

    if (rawSettings && rawSettings.length > 0) {
      return rawSettings[0];
    }

    return null;
  }

  private normalizeRawUpdateSystemSettings(raw: Record<string, unknown>): UpdateSystemSettings {
    return {
      id: this.pickRawValue<string>(raw, ['id']) || 'default',
      appVersion: this.pickRawValue<string>(raw, ['appVersion', 'app_version']) || '1.0.0',
      gitToken: this.pickRawValue<string | null>(raw, ['gitToken', 'git_token']) || null,
      gitUsername: this.pickRawValue<string | null>(raw, ['gitUsername', 'git_username']) || null,
      gitRepository: this.pickRawValue<string | null>(raw, ['gitRepository', 'git_repository']) || null,
      gitReleaseBranch: this.pickRawValue<string>(raw, ['gitReleaseBranch', 'git_release_branch']) || 'main',
      packageManager: this.pickRawValue<string>(raw, ['packageManager', 'package_manager']) || 'docker',
      updateCheckEnabled: this.pickRawValue<boolean>(raw, ['updateCheckEnabled', 'update_check_enabled']) ?? true,
      updateChannel: this.pickRawValue<string>(raw, ['updateChannel', 'update_channel']) || 'release',
      lastUpdateCheck: this.asDateOrNull(this.pickRawValue(raw, ['lastUpdateCheck', 'last_update_check'])),
      availableVersion: this.pickRawValue<string | null>(raw, ['availableVersion', 'available_version']) || null,
      updateAvailable: this.pickRawValue<boolean>(raw, ['updateAvailable', 'update_available']) ?? false,
      releaseTag: this.pickRawValue<string | null>(raw, ['releaseTag', 'release_tag']) || 'latest',
      composeFile: this.pickRawValue<string | null>(raw, ['composeFile', 'compose_file']) || 'docker-compose.prod.yml',
      envFile: this.pickRawValue<string | null>(raw, ['envFile', 'env_file']) || 'install/.env.production',
      updatedAt: this.asDateOrNull(this.pickRawValue(raw, ['updatedAt', 'updated_at'])) || new Date(),
      updatedBy: this.pickRawValue<string | null>(raw, ['updatedBy', 'updated_by']) || null,
    } as UpdateSystemSettings;
  }

  private pickRawValue<T>(raw: Record<string, unknown>, candidates: string[]): T | undefined {
    for (const candidate of candidates) {
      if (candidate in raw) {
        return raw[candidate] as T;
      }
    }

    return undefined;
  }

  private asDateOrNull(value: unknown): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private async createLegacyDefaultSystemSettings(): Promise<UpdateSystemSettings> {
    const now = new Date();
    const id = crypto.randomUUID();
    const columns = await this.getUpdateSystemSettingsColumns();
    const initialValues = new Map<string, unknown>([
      ['id', id],
      ['appVersion', this.getRuntimeVersionInfo().version],
      ['gitReleaseBranch', 'main'],
      ['packageManager', 'docker'],
      ['updateCheckEnabled', true],
      ['updateAvailable', false],
      ['updatedAt', now],
    ]);

    const inserts = Array.from(initialValues.entries())
      .filter(([column]) => columns.has(column.toLowerCase()))
      .map(([column, value]) => ({
        identifier: Prisma.raw(`"${column}"`),
        value,
      }));

    if (inserts.length > 0) {
      await this.prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO "update_system_settings" (${Prisma.join(inserts.map((entry) => entry.identifier), ', ')})
          VALUES (${Prisma.join(inserts.map((entry) => entry.value), ', ')})
        `,
      );
    }

    return {
      id,
      appVersion: this.getRuntimeVersionInfo().version,
      gitToken: null,
      gitUsername: null,
      gitRepository: null,
      gitReleaseBranch: 'main',
      packageManager: 'docker',
      updateCheckEnabled: true,
      updateChannel: 'release',
      lastUpdateCheck: null,
      availableVersion: null,
      updateAvailable: false,
      releaseTag: 'latest',
      composeFile: 'docker-compose.prod.yml',
      envFile: 'install/.env.production',
      updatedAt: now,
      updatedBy: null,
    } as UpdateSystemSettings;
  }

  private async getUpdateSystemSettingsColumns(): Promise<Set<string>> {
    if (this.updateSystemSettingsColumnsCache) {
      return this.updateSystemSettingsColumnsCache;
    }

    const result = await this.prisma.$queryRaw<Array<{ column_name: string }>>(
      Prisma.sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'update_system_settings'
      `,
    );

    this.updateSystemSettingsColumnsCache = new Set(result.map((row) => String(row.column_name).toLowerCase()));
    return this.updateSystemSettingsColumnsCache;
  }

  private unwrapUpdateSystemSettingValue(value: unknown): string | boolean | Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || typeof value === 'string' || typeof value === 'boolean' || value instanceof Date) {
      return value as string | boolean | Date | null;
    }

    if (typeof value === 'object' && value !== null && 'set' in (value as Record<string, unknown>)) {
      return this.unwrapUpdateSystemSettingValue((value as Record<string, unknown>).set);
    }

    return undefined;
  }

  private async updateSystemSettingsWithRawSql(
    settingsId: string,
    data: Prisma.UpdateSystemSettingsUncheckedUpdateInput,
  ): Promise<void> {
    const columns = await this.getUpdateSystemSettingsColumns();
    const assignments: Prisma.Sql[] = [];
    const fieldMap: Array<[keyof Prisma.UpdateSystemSettingsUncheckedUpdateInput, string]> = [
      ['appVersion', 'appVersion'],
      ['gitToken', 'gitToken'],
      ['gitUsername', 'gitUsername'],
      ['gitRepository', 'gitRepository'],
      ['gitReleaseBranch', 'gitReleaseBranch'],
      ['packageManager', 'packageManager'],
      ['updateCheckEnabled', 'updateCheckEnabled'],
      ['updateChannel', 'updateChannel'],
      ['lastUpdateCheck', 'lastUpdateCheck'],
      ['availableVersion', 'availableVersion'],
      ['updateAvailable', 'updateAvailable'],
      ['releaseTag', 'releaseTag'],
      ['composeFile', 'composeFile'],
      ['envFile', 'envFile'],
      ['updatedBy', 'updatedBy'],
    ];

    for (const [field, column] of fieldMap) {
      if (!columns.has(column.toLowerCase())) {
        continue;
      }

      const value = this.unwrapUpdateSystemSettingValue(data[field]);
      if (value === undefined) {
        continue;
      }

      assignments.push(Prisma.sql`${Prisma.raw(`"${column}"`)} = ${value}`);
    }

    if (columns.has('updatedat')) {
      assignments.push(Prisma.sql`"updatedAt" = ${new Date()}`);
    }

    if (assignments.length === 0) {
      this.logger.warn('Fallback SQL do update_system_settings não encontrou colunas compatíveis para atualização.');
      return;
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "update_system_settings"
        SET ${Prisma.join(assignments, ', ')}
        WHERE "id" = ${settingsId}
      `,
    );
  }

  private getInstallationMode(settings: UpdateSystemSettings): 'docker' | 'native' {
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

    if (settings.packageManager) {
      if (settings.packageManager === 'docker' || settings.packageManager === 'native') {
        return settings.packageManager as 'docker' | 'native';
      }
    }
    return 'native';
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

  private selectCandidateReleaseTags(tags: string[], currentVersion: string): string[] {
    const uniqueSorted = Array.from(new Set(tags)).sort((a, b) => semver.rcompare(a, b));
    if (uniqueSorted.length === 0) {
      return [];
    }

    const current = semver.parse(currentVersion);
    if (!current) {
      return uniqueSorted;
    }

    const sameLine = uniqueSorted.filter((tag) => {
      const parsed = semver.parse(tag);
      return !!parsed && parsed.major === current.major && parsed.minor === current.minor;
    });

    return sameLine.length > 0 ? sameLine : uniqueSorted;
  }

  private buildPublicGitRepoUrl(settings: UpdateSystemSettings): string {
    const repository = String(settings.gitRepository || '').replace(/\.git$/i, '');
    return `https://github.com/${settings.gitUsername}/${repository}.git`;
  }

  private async getRemoteTagsOutput(repoUrl: string, encryptedGitToken?: string, branch?: string): Promise<string> {
    const options = { timeout: 60_000, cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 };
    const gitArgs = ['ls-remote', '--tags', repoUrl];
    if (branch) {
      // Se uma branch for especificada, poderíamos tentar filtrar, 
      // mas ls-remote --tags geralmente retorna todas as tags do repositório.
      // No entanto, manter o parâmetro permite futuras expansões de lógica.
    }

    if (!encryptedGitToken) {
      const { stdout } = await this.execFileAsync('git', gitArgs, options);
      return stdout;
    }

    let decryptedToken = '';
    try {
      decryptedToken = this.tryDecryptToken(encryptedGitToken);
      if (!decryptedToken) {
        const { stdout } = await this.execFileAsync('git', gitArgs, options);
        return stdout;
      }

      const authHeaderValue = `Bearer ${decryptedToken}`;
      const headerArg = `http.extraHeader=AUTHORIZATION: ${authHeaderValue}`;
      const { stdout } = await this.execFileAsync(
        'git',
        ['-c', headerArg, ...gitArgs],
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
      const { stdout } = await this.execFileAsync('git', gitArgs, options);
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
