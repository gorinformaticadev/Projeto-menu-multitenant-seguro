import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExecuteUpdateDto, UpdateConfigDto, UpdateStatusDto } from './dto/update.dto';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as semver from 'semver';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * ServiÃ§o principal do Sistema de AtualizaÃ§Ãµes
 * 
 * Responsabilidades:
 * - Verificar versÃµes disponÃ­veis no repositÃ³rio Git
 * - Executar atualizaÃ§Ãµes com backup e rollback
 * - Gerenciar configuraÃ§Ãµes do sistema
 * - Registrar logs de auditoria
 */
@Injectable()
export class UpdateService {
  private readonly logger = new Logger(UpdateService.name);
  private readonly encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) { }

  /**
   * Verifica se hÃ¡ atualizaÃ§Ãµes disponÃ­veis no repositÃ³rio Git
   * Compara versÃµes usando semver e atualiza status no banco
   */
  async checkForUpdates(): Promise<{ updateAvailable: boolean; availableVersion?: string }> {
    try {
      this.logger.log('Iniciando verificaÃ§Ã£o de atualizaÃ§Ãµes...');

      // Buscar configuraÃ§Ãµes do sistema
      const settings = await this.getSystemSettings();

      if (!settings.gitUsername || !settings.gitRepository) {
        this.logger.warn('ConfiguraÃ§Ãµes do Git nÃ£o encontradas');
        return { updateAvailable: false };
      }

      // Construir URL do repositÃ³rio
      const repoUrl = `https://github.com/${settings.gitUsername}/${settings.gitRepository}.git`;

      // Buscar tags remotas
      const { stdout } = await execAsync(`git ls-remote --tags ${repoUrl}`);

      // Extrair versÃµes vÃ¡lidas (semver)
      const tags = stdout
        .split('\n')
        .map(line => line.split('\t')[1])
        .filter(ref => ref && ref.includes('refs/tags/'))
        .map(ref => ref.replace('refs/tags/', '').replace('^{}', ''))
        .filter(tag => semver.valid(semver.clean(tag)))
        .sort((a, b) => semver.rcompare(semver.clean(a)!, semver.clean(b)!));

      if (tags.length === 0) {
        this.logger.warn('Nenhuma tag vÃ¡lida encontrada no repositÃ³rio');
        return { updateAvailable: false };
      }

      const latestVersion = semver.clean(tags[0])!;
      const currentVersion = semver.clean(settings.appVersion || '1.0.0')!;

      const updateAvailable = semver.gt(latestVersion, currentVersion);

      // Atualizar status no banco
      await this.updateSystemSettings({
        availableVersion: latestVersion,
        updateAvailable,
        lastUpdateCheck: new Date(),
      });

      this.logger.log(`VerificaÃ§Ã£o concluÃ­da. VersÃ£o atual: ${currentVersion}, DisponÃ­vel: ${latestVersion}, Update disponÃ­vel: ${updateAvailable}`);

      return { updateAvailable, availableVersion: latestVersion };
    } catch (error) {
      this.logger.error('Erro ao verificar atualizaÃ§Ãµes:', error);
      throw new HttpException(
        'Erro ao verificar atualizaÃ§Ãµes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Executa atualizaÃ§Ã£o para versÃ£o especificada
   * Inclui backup automÃ¡tico, rollback em caso de falha
   */
  async executeUpdate(
    updateData: ExecuteUpdateDto,
    executedBy: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; logId: string; message: string }> {
    let updateLog: any;

    try {
      this.logger.log(`Iniciando atualizaÃ§Ã£o para versÃ£o ${updateData.version}...`);

      // Verificar se jÃ¡ existe uma atualizaÃ§Ã£o em andamento
      const runningUpdate = await (this.prisma as any).updateLog.findFirst({
        where: { status: 'STARTED' },
      });

      if (runningUpdate) {
        throw new HttpException(
          'JÃ¡ existe uma atualizaÃ§Ã£o em andamento',
          HttpStatus.CONFLICT,
        );
      }

      // Criar log de atualizaÃ§Ã£o
      updateLog = await (this.prisma as any).updateLog.create({
        data: {
          version: updateData.version,
          status: 'STARTED',
          packageManager: updateData.packageManager || 'npm',
          executedBy,
          ipAddress,
          userAgent,
        },
      });

      // Registrar auditoria
      await this.auditService.log({
        action: 'UPDATE_STARTED',
        userId: executedBy,
        tenantId: null,
        ipAddress,
        userAgent,
        details: { version: updateData.version, logId: updateLog.id },
      });

      // Executar script de atualizaÃ§Ã£o
      const scriptPath = path.join(process.cwd(), 'scripts', 'update.sh');
      const command = `bash ${scriptPath} ${updateData.version} ${updateData.packageManager}`;

      this.logger.log(`Executando comando: ${command}`);

      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30 * 60 * 1000, // 30 minutos timeout
        cwd: process.cwd(),
      });

      const duration = Math.floor((Date.now() - startTime) / 1000);

      // Atualizar log como sucesso
      await (this.prisma as any).updateLog.update({
        where: { id: updateLog.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          duration,
          executionLogs: JSON.stringify({ stdout, stderr }),
        },
      });

      // Atualizar versÃ£o atual no sistema
      await this.updateSystemSettings({
        appVersion: updateData.version,
        updateAvailable: false,
      });

      // Registrar auditoria de sucesso
      await this.auditService.log({
        action: 'UPDATE_SUCCESS',
        userId: executedBy,
        tenantId: null,
        ipAddress,
        userAgent,
        details: { version: updateData.version, duration, logId: updateLog.id },
      });

      this.logger.log(`AtualizaÃ§Ã£o para ${updateData.version} concluÃ­da com sucesso em ${duration}s`);

      return {
        success: true,
        logId: updateLog.id,
        message: `AtualizaÃ§Ã£o para ${updateData.version} concluÃ­da com sucesso`,
      };

    } catch (error) {
      this.logger.error('Erro durante atualizaÃ§Ã£o:', error);

      if (updateLog) {
        // Atualizar log como falha
        await (this.prisma as any).updateLog.update({
          where: { id: updateLog.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: error.message,
            executionLogs: JSON.stringify({ error: error.message }),
          },
        });

        // Registrar auditoria de falha
        await this.auditService.log({
          action: 'UPDATE_FAILED',
          userId: executedBy,
          tenantId: null,
          ipAddress,
          userAgent,
          details: { version: updateData.version, error: error.message, logId: updateLog.id },
        });
      }

      throw new HttpException(
        `Erro durante atualizaÃ§Ã£o: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Retorna status atual do sistema de atualizaÃ§Ãµes
   */
  async getUpdateStatus(): Promise<UpdateStatusDto> {
    const settings = await this.getSystemSettings();

    return {
      currentVersion: settings.appVersion || '1.0.0',
      availableVersion: settings.availableVersion || undefined,
      updateAvailable: settings.updateAvailable || false,
      lastCheck: settings.lastUpdateCheck || undefined,
      isConfigured: !!(settings.gitUsername && settings.gitRepository),
      checkEnabled: settings.updateCheckEnabled || false,
    };
  }

  /**
   * Atualiza configuraÃ§Ãµes do sistema de updates
   */
  async updateConfig(
    config: UpdateConfigDto,
    updatedBy: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Criptografar token se fornecido
      const updateData: any = { ...config, updatedBy };

      if (config.gitToken) {
        updateData.gitToken = this.encryptToken(config.gitToken);
      }

      await this.updateSystemSettings(updateData);

      // Registrar auditoria
      await this.auditService.log({
        action: 'UPDATE_CONFIG_CHANGED',
        userId: updatedBy,
        tenantId: null,
        ipAddress: undefined,
        userAgent: undefined,
        details: { configFields: Object.keys(config) },
      });

      this.logger.log('ConfiguraÃ§Ãµes do sistema de updates atualizadas');

      return {
        success: true,
        message: 'ConfiguraÃ§Ãµes atualizadas com sucesso',
      };
    } catch (error) {
      this.logger.error('Erro ao atualizar configuraÃ§Ãµes:', error);
      throw new HttpException(
        'Erro ao atualizar configuraÃ§Ãµes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Retorna histÃ³rico de atualizaÃ§Ãµes
   */
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

  /**
   * Retorna detalhes de um log especÃ­fico
   */
  async getUpdateLogDetails(logId: string): Promise<any> {
    const log = await (this.prisma as any).updateLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      throw new HttpException('Log nÃ£o encontrado', HttpStatus.NOT_FOUND);
    }

    return log;
  }

  /**
   * Busca ou cria configuraÃ§Ãµes do sistema
   */
  private async getSystemSettings(): Promise<any> {
    let settings = await (this.prisma as any).systemSettings.findFirst();

    if (!settings) {
      settings = await (this.prisma as any).systemSettings.create({
        data: {
          appVersion: '1.0.0',
          packageManager: 'npm',
          updateCheckEnabled: true,
          gitReleaseBranch: 'main',
        },
      });
    }

    return settings;
  }

  /**
   * Atualiza configuraÃ§Ãµes do sistema
   */
  private async updateSystemSettings(data: any): Promise<void> {
    const settings = await this.getSystemSettings();

    await (this.prisma as any).systemSettings.update({
      where: { id: settings.id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  /**
   * Criptografa token Git para armazenamento seguro
   */
  private encryptToken(token: string): string {
    // Usar IV fixo baseado na chave para compatibilidade
    const iv = crypto.scryptSync(this.encryptionKey, 'salt', 16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey.substring(0, 32), iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Descriptografa token Git
   */
  private decryptToken(encryptedToken: string): string {
    const [ivHex, encrypted] = encryptedToken.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey.substring(0, 32), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
