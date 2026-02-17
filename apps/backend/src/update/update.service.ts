import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExecuteUpdateDto, UpdateConfigDto, UpdateStatusDto } from './dto/update.dto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as semver from 'semver';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

@Injectable()
export class UpdateService {
  private readonly logger = new Logger(UpdateService.name);
  private readonly encryptionKeyRaw = process.env.ENCRYPTION_KEY || '';
  private readonly encryptionKey: Buffer;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {
    this.encryptionKey = this.resolveEncryptionKey();
  }

  async checkForUpdates(): Promise<{ updateAvailable: boolean; availableVersion?: string }> {
    try {
      this.logger.log('Iniciando verificacao de atualizacoes...');
      const settings: any = await this.getSystemSettings();

      if (!settings.gitUsername || !settings.gitRepository) {
        this.logger.warn('Configuracoes do Git nao encontradas');
        return { updateAvailable: false };
      }

      const repoUrl = this.buildPublicGitRepoUrl(settings);
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
        this.logger.warn('Nenhuma tag valida encontrada no repositorio');
        return { updateAvailable: false };
      }

      const latestClean = uniqueCleanTags[0];
      const latestVersion = this.formatVersion(latestClean);
      const currentClean = semver.clean(settings.appVersion || 'v1.0.0') || '1.0.0';
      const updateAvailable = semver.gt(latestClean, currentClean);

      await this.updateSystemSettings({
        availableVersion: latestVersion,
        updateAvailable,
        lastUpdateCheck: new Date(),
      });

      return { updateAvailable, availableVersion: latestVersion };
    } catch (_error) {
      // Nao expor detalhes do comando git para evitar vazamento de credenciais.
      this.logger.error('Erro ao verificar atualizacoes');
      throw new HttpException('Erro ao verificar atualizacoes', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async executeUpdate(
    updateData: ExecuteUpdateDto,
    executedBy: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; logId: string; message: string }> {
    let updateLog: any;
    let requestedVersion = updateData.version;

    try {
      const runningUpdate = await (this.prisma as any).updateLog.findFirst({
        where: { status: 'STARTED' },
        orderBy: { startedAt: 'asc' },
      });

      if (runningUpdate) {
        const startedAt = runningUpdate.startedAt ? new Date(runningUpdate.startedAt) : new Date();
        const ageMs = Date.now() - startedAt.getTime();
        if (ageMs > 60 * 60 * 1000) {
          await (this.prisma as any).updateLog.update({
            where: { id: runningUpdate.id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              rollbackReason: 'stale lock',
              errorMessage: 'Update lock stale detectado (>60 minutos)',
            },
          });
        } else {
          throw new HttpException('Ja existe uma atualizacao em andamento', HttpStatus.CONFLICT);
        }
      }

      const normalizedCleanVersion = semver.clean(updateData.version);
      if (!normalizedCleanVersion) {
        throw new HttpException('Versao invalida', HttpStatus.BAD_REQUEST);
      }
      const normalizedVersion = this.formatVersion(normalizedCleanVersion);
      requestedVersion = normalizedVersion;

      const settings: any = await this.getSystemSettings();
      const currentVersion = semver.clean(settings.appVersion || 'v1.0.0') || '1.0.0';

      if (!semver.gt(normalizedCleanVersion, currentVersion)) {
        updateLog = await (this.prisma as any).updateLog.create({
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
              message: `Versao ${normalizedVersion} ja aplicada (atual: ${currentVersion})`,
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
          message: `Versao ${normalizedVersion} ja esta aplicada. Nenhum redeploy executado.`,
        };
      }

      updateLog = await (this.prisma as any).updateLog.create({
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
      const deployResult = await this.runSafeImageDeploy(normalizedVersion, settings);
      const combinedOutput = `${deployResult.stdout || ''}\n${deployResult.stderr || ''}`;
      if (combinedOutput.includes('ROLLBACK_COMPLETED')) {
        const rollbackError: any = new Error('Deploy reportou rollback automatico; versao anterior foi mantida');
        rollbackError.stdout = deployResult.stdout || '';
        rollbackError.stderr = deployResult.stderr || '';
        rollbackError.exitCode = 2;
        rollbackError.status = HttpStatus.INTERNAL_SERVER_ERROR;
        throw rollbackError;
      }
      const duration = Math.floor((Date.now() - startTime) / 1000);

      await (this.prisma as any).updateLog.update({
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
        message: `Atualizacao para ${normalizedVersion} concluida com sucesso`,
      };
    } catch (error: any) {
      this.logger.error('Erro durante atualizacao:', error);
      const stdout = typeof error?.stdout === 'string' ? error.stdout : '';
      const stderr = typeof error?.stderr === 'string' ? error.stderr : '';
      const combinedErrorOutput = `${stdout}\n${stderr}\n${error?.message || ''}`;
      const exitCode = Number(error?.code ?? error?.exitCode ?? -1);
      const rollbackDetected =
        combinedErrorOutput.includes('ROLLBACK_COMPLETED') || exitCode === 2;

      if (updateLog) {
        await (this.prisma as any).updateLog.update({
          where: { id: updateLog.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: error.message,
            rollbackReason: rollbackDetected ? 'automatic rollback executed' : undefined,
            executionLogs: JSON.stringify({
              error: error.message,
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
          details: { version: requestedVersion, error: error.message, rollbackDetected, logId: updateLog.id },
        });
      }

      throw new HttpException(
        rollbackDetected
          ? `Erro durante atualizacao: ${error.message}. Rollback automatico executado.`
          : `Erro durante atualizacao: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUpdateStatus(): Promise<UpdateStatusDto> {
    const settings: any = await this.getSystemSettings();
    return {
      currentVersion: this.formatVersion(settings.appVersion || 'v1.0.0'),
      availableVersion: settings.availableVersion ? this.formatVersion(settings.availableVersion) : undefined,
      updateAvailable: settings.updateAvailable || false,
      lastCheck: settings.lastUpdateCheck || undefined,
      isConfigured: !!(settings.gitUsername && settings.gitRepository),
      checkEnabled: settings.updateCheckEnabled || false,
    };
  }

  async updateConfig(config: UpdateConfigDto, updatedBy: string): Promise<{ success: boolean; message: string }> {
    try {
      const updateData: any = { ...config, updatedBy };

      if (config.gitToken) {
        updateData.gitToken = this.encryptToken(config.gitToken);
      }

      if (config.releaseTag) {
        const normalized = semver.clean(config.releaseTag);
        if (!normalized) {
          throw new HttpException('releaseTag invalida', HttpStatus.BAD_REQUEST);
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

      return { success: true, message: 'Configuracoes atualizadas com sucesso' };
    } catch (error) {
      this.logger.error('Erro ao atualizar configuracoes:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Erro ao atualizar configuracoes', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getUpdateLogs(limit: number = 50): Promise<any[]> {
    return (this.prisma as any).updateLog.findMany({
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

  async getUpdateLogDetails(logId: string): Promise<unknown> {
    const log = await (this.prisma as any).updateLog.findUnique({ where: { id: logId } });
    if (!log) {
      throw new HttpException('Log nao encontrado', HttpStatus.NOT_FOUND);
    }
    return log;
  }

  private async getSystemSettings(): Promise<unknown> {
    let settings = await (this.prisma as any).systemSettings.findFirst();

    if (!settings) {
      settings = await (this.prisma as any).systemSettings.create({
        data: {
          appVersion: 'v1.0.0',
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

  private async updateSystemSettings(data: any): Promise<void> {
    const settings: any = await this.getSystemSettings();
    await (this.prisma as any).systemSettings.update({
      where: { id: settings.id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  private async runSafeImageDeploy(version: string, settings: any): Promise<{ stdout: string; stderr: string }> {
    const scriptPath = path.join(process.cwd(), 'install', 'update-images.sh');
    if (!fs.existsSync(scriptPath)) {
      throw new HttpException('Runner de deploy nao encontrado (install/update-images.sh)', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const composeFile = settings.composeFile || 'docker-compose.prod.yml';
    const envFile = settings.envFile || 'install/.env.production';

    const allowedCompose = new Set(['docker-compose.prod.yml', 'docker-compose.prod.external.yml']);
    const allowedEnv = new Set(['install/.env.production', '.env.production', '.env']);

    if (!allowedCompose.has(composeFile)) {
      throw new HttpException('composeFile nao permitido para deploy', HttpStatus.BAD_REQUEST);
    }
    if (!allowedEnv.has(envFile)) {
      throw new HttpException('envFile nao permitido para deploy', HttpStatus.BAD_REQUEST);
    }

    const env = {
      ...process.env,
      PROJECT_ROOT: process.cwd(),
      RELEASE_TAG: version,
      COMPOSE_FILE: composeFile,
      ENV_FILE: envFile,
      HEALTH_TIMEOUT: process.env.UPDATE_HEALTH_TIMEOUT || '120',
    };

    return execFileAsync('bash', [scriptPath], {
      cwd: process.cwd(),
      env,
      timeout: 30 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024,
    });
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
      throw new Error('ENCRYPTION_KEY ausente ou fraca para ambiente de producao');
    }

    if (isWeak) {
      this.logger.warn('ENCRYPTION_KEY fraca/ausente fora de producao. Usando derivacao temporaria.');
    }

    const source = key || 'development-only-insecure-key';
    return crypto.createHash('sha256').update(source, 'utf8').digest();
  }

  private decryptTokenLegacyCbc(encryptedToken: string): string {
    const [ivHex, encrypted] = encryptedToken.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Token criptografado invalido');
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
    const clean = semver.clean(version);
    return clean ? `v${clean}` : version;
  }

  private buildPublicGitRepoUrl(settings: any): string {
    const repository = String(settings.gitRepository || '').replace(/\.git$/i, '');
    return `https://github.com/${settings.gitUsername}/${repository}.git`;
  }

  private async getRemoteTagsOutput(repoUrl: string, encryptedGitToken?: string): Promise<string> {
    const options = { timeout: 60_000, cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 };
    if (!encryptedGitToken) {
      const { stdout } = await execFileAsync('git', ['ls-remote', '--tags', repoUrl], options);
      return stdout;
    }

    let decryptedToken = '';
    try {
      decryptedToken = this.decryptToken(encryptedGitToken);
      if (!decryptedToken) {
        const { stdout } = await execFileAsync('git', ['ls-remote', '--tags', repoUrl], options);
        return stdout;
      }

      const basicAuth = Buffer.from(`x-access-token:${decryptedToken}`, 'utf8').toString('base64');
      const headerArg = `http.extraHeader=AUTHORIZATION: basic ${basicAuth}`;
      const { stdout } = await execFileAsync(
        'git',
        ['-c', headerArg, 'ls-remote', '--tags', repoUrl],
        options,
      );
      return stdout;
    } catch (error: any) {
      const sanitizedStderr = this.sanitizeSensitiveOutput(String(error?.stderr || error?.message || ''), decryptedToken);
      this.logger.warn(`Falha ao usar gitToken; tentando repositorio sem autenticacao. detalhe=${sanitizedStderr}`);
      const { stdout } = await execFileAsync('git', ['ls-remote', '--tags', repoUrl], options);
      return stdout;
    }
  }

  private sanitizeSensitiveOutput(output: string, token?: string): string {
    if (!output) return '';
    if (!token) return output;

    const basicAuth = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
    const secrets = [token, basicAuth, `x-access-token:${token}`, `AUTHORIZATION: basic ${basicAuth}`];

    let sanitized = output;
    for (const secret of secrets) {
      if (secret) {
        sanitized = sanitized.split(secret).join('[REDACTED]');
      }
    }
    return sanitized;
  }
}

