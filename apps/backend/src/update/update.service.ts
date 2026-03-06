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
import { Prisma, SystemSettings, UpdateLog } from '@prisma/client';
import { SystemVersionService } from '@common/services/system-version.service';

type UpdateExecutionResult = { stdout: string; stderr: string };
type UpdateLogListItem = Pick<
  UpdateLog,
  'id' | 'version' | 'status' | 'startedAt' | 'completedAt' | 'duration' | 'packageManager' | 'errorMessage' | 'rollbackReason' | 'executedBy'
>;
type UpdateExecutionError = Error & {
  stdout?: string;
  stderr?: string;
  status?: number;
  code?: number | string;
  exitCode?: number;
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
      const stdout = await this.getRemoteTagsOutput(repoUrl, settings.gitToken);

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
  ): Promise<{ success: boolean; logId: string; message: string }> {
    let updateLog: UpdateLog | null = null;
    let requestedVersion = updateData.version;

    try {
      const runningUpdate = await this.prisma.updateLog.findFirst({
        where: { status: 'STARTED' },
        orderBy: { startedAt: 'asc' },
      });

      if (runningUpdate) {
        const startedAt = runningUpdate.startedAt ? new Date(runningUpdate.startedAt) : new Date();
        const ageMs = Date.now() - startedAt.getTime();
        if (ageMs > 60 * 60 * 1000) {
          await this.prisma.updateLog.update({
            where: { id: runningUpdate.id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              rollbackReason: 'stale lock',
              errorMessage: 'Update lock stale detectado (>60 minutos)',
            },
          });
        } else {
          throw new HttpException('Já existe uma atualização em andamento', HttpStatus.CONFLICT);
        }
      }

      const normalizedCleanVersion = semver.clean(updateData.version);
      if (!normalizedCleanVersion) {
        throw new HttpException('Versão inválida', HttpStatus.BAD_REQUEST);
      }
      const normalizedVersion = this.formatVersion(normalizedCleanVersion);
      requestedVersion = normalizedVersion;

      const settings = await this.getSystemSettings();
      const currentVersion = this.getComparableVersion(this.getRuntimeVersionInfo().version);

      if (!semver.gt(normalizedCleanVersion, currentVersion)) {
        updateLog = await this.prisma.updateLog.create({
          data: {
            version: normalizedVersion,
            status: 'SUCCESS',
            packageManager: 'docker',
            executedBy,
            ipAddress,
            userAgent,
            completedAt: new Date(),
            duration: 0,
            executionLogs: JSON.stringify({
              idempotent: true,
              message: `Versão ${normalizedVersion} já aplicada (atual: ${currentVersion})`,
            }),
          },
        });

        await this.auditService.log({
          action: 'UPDATE_SKIPPED',
          userId: executedBy,
          tenantId: null,
          ipAddress,
          userAgent,
          details: { version: normalizedVersion, currentVersion, reason: 'idempotent-skip' },
        });

        return {
          success: true,
          logId: updateLog.id,
          message: `Versão ${normalizedVersion} já aplicada. Nenhum redeploy executado.`,
        };
      }

      updateLog = await this.prisma.updateLog.create({
        data: {
          version: normalizedVersion,
          status: 'STARTED',
          packageManager: 'docker',
          executedBy,
          ipAddress,
          userAgent,
        },
      });

      await this.auditService.log({
        action: 'UPDATE_STARTED',
        userId: executedBy,
        tenantId: null,
        ipAddress,
        userAgent,
        details: { version: normalizedVersion, logId: updateLog.id },
      });

      const startTime = Date.now();
      const mode = this.getInstallationMode();

      const deployResult = mode === 'docker'
        ? await this.runSafeImageDeploy(normalizedVersion, settings)
        : await this.runSafeNativeDeploy(normalizedVersion, settings);

      const combinedOutput = `${deployResult.stdout || ''}\n${deployResult.stderr || ''}`;
      if (combinedOutput.includes('ROLLBACK_COMPLETED')) {
        const rollbackError = this.asUpdateExecutionError(
          new Error('Deploy reportou rollback automático; versão anterior foi mantida'),
        );
        rollbackError.stdout = deployResult.stdout || '';
        rollbackError.stderr = deployResult.stderr || '';
        rollbackError.exitCode = 2;
        rollbackError.status = HttpStatus.INTERNAL_SERVER_ERROR;
        throw rollbackError;
      }
      const duration = Math.floor((Date.now() - startTime) / 1000);

      await this.prisma.updateLog.update({
        where: { id: updateLog.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          duration,
          executionLogs: JSON.stringify(deployResult),
        },
      });

      await this.updateSystemSettings({
        appVersion: normalizedVersion,
        releaseTag: normalizedVersion,
        updateAvailable: false,
      });

      await this.auditService.log({
        action: 'UPDATE_SUCCESS',
        userId: executedBy,
        tenantId: null,
        ipAddress,
        userAgent,
        details: { version: normalizedVersion, duration, logId: updateLog.id },
      });

      return {
        success: true,
        logId: updateLog.id,
        message: `Atualização para ${normalizedVersion} concluída com sucesso`,
      };
    } catch (error: unknown) {
      const parsedError = this.asUpdateExecutionError(error);
      const stdoutRaw = typeof parsedError.stdout === 'string' ? parsedError.stdout : '';
      const stderrRaw = typeof parsedError.stderr === 'string' ? parsedError.stderr : '';
      const errorMessageRaw = String(parsedError.message || 'Erro desconhecido durante atualização');
      const stdout = this.sanitizeGitError(stdoutRaw);
      const stderr = this.sanitizeGitError(stderrRaw);
      const errorMessage = this.sanitizeGitError(errorMessageRaw);
      this.logger.error(`Erro durante atualização: ${errorMessage}`);
      const combinedErrorOutput = `${stdout}\n${stderr}\n${errorMessage}`;
      const exitCode = Number(parsedError.code ?? parsedError.exitCode ?? -1);
      const rollbackDetected =
        combinedErrorOutput.includes('ROLLBACK_COMPLETED') || exitCode === 2;

      if (updateLog) {
        await this.prisma.updateLog.update({
          where: { id: updateLog.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage,
            rollbackReason: rollbackDetected ? 'automatic rollback executed' : undefined,
            executionLogs: JSON.stringify({
              error: errorMessage,
              stdout,
              stderr,
              rollbackDetected,
            }),
          },
        });

        await this.auditService.log({
          action: 'UPDATE_FAILED',
          userId: executedBy,
          tenantId: null,
          ipAddress,
          userAgent,
          details: { version: requestedVersion, error: errorMessage, rollbackDetected, logId: updateLog.id },
        });
      }

      throw new HttpException(
        rollbackDetected
          ? `Erro durante atualização: ${errorMessage}. Rollback automático executado.`
          : `Erro durante atualização: ${errorMessage}`,
        parsedError.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUpdateStatus(): Promise<UpdateStatusDto> {
    const settings = await this.getSystemSettings();
    const runtimeVersion = this.getRuntimeVersionInfo().version;
    return {
      currentVersion: this.formatVersion(runtimeVersion),
      availableVersion: settings.availableVersion ? this.formatVersion(settings.availableVersion) : undefined,
      updateAvailable: settings.updateAvailable || false,
      lastCheck: settings.lastUpdateCheck || undefined,
      isConfigured: !!(settings.gitUsername && settings.gitRepository),
      checkEnabled: settings.updateCheckEnabled || false,
      mode: this.getInstallationMode(),
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
      const updateData: Prisma.SystemSettingsUncheckedUpdateInput = { updatedBy };

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

  private async getSystemSettings(): Promise<SystemSettings> {
    let settings = await this.prisma.systemSettings.findFirst();

    if (!settings) {
      settings = await this.prisma.systemSettings.create({
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

  private async updateSystemSettings(data: Prisma.SystemSettingsUncheckedUpdateInput): Promise<void> {
    const settings = await this.getSystemSettings();
    await this.prisma.systemSettings.update({
      where: { id: settings.id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  private async runSafeImageDeploy(version: string, settings: SystemSettings): Promise<UpdateExecutionResult> {
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

  private async runSafeNativeDeploy(version: string, settings: SystemSettings): Promise<UpdateExecutionResult> {
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

  private buildPublicGitRepoUrl(settings: SystemSettings): string {
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
