import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { CreateBackupDto } from './dto/create-backup.dto';

/**
 * Serviço responsável por operações de backup e restore do banco de dados
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly tempDir: string;
  private readonly maxFileSize: number;
  private readonly timeout: number;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {
    // Configurações a partir de variáveis de ambiente
    // Usar diretório permanente para backups (não temporário)
    this.tempDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
    this.maxFileSize = parseInt(process.env.BACKUP_MAX_SIZE || '2147483648', 10); // 2GB
    this.timeout = parseInt(process.env.BACKUP_TIMEOUT || '900', 10) * 1000; // 15 min em ms

    // Criar diretório de backups se não existir
    this.ensureTempDirExists();
  }

  /**
   * Retorna o diretório raiz onde os backups ficam armazenados.
   */
  getBackupsDir(): string {
    return this.tempDir;
  }

  /**
   * Garante que o diretório de backups existe
   */
  private ensureTempDirExists(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      this.logger.log(`Diretório de backups criado: ${this.tempDir}`);
    }
  }

  /**
   * Cria backup completo do banco de dados
   */
  async createBackup(
    dto: CreateBackupDto,
    userId: string,
    ipAddress?: string,
    onProgress?: (message: string) => void,
  ): Promise<{
    backupId: string;
    fileName: string;
    fileSize: number;
    checksum: string;
    downloadUrl: string;
    createdAt: Date;
  }> {
    const startTime = Date.now();
    let backupLog: any;

    try {
      // Validar userId
      if (!userId) {
        throw new Error('UserId é obrigatório para criar backup');
      }

      // Extrair credenciais do DATABASE_URL
      const dbConfig = this.parseDatabaseUrl();
      
      // Gerar nome do arquivo com timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `backup_${dbConfig.database}_${timestamp}.dump`;
      const filePath = path.join(this.tempDir, fileName);

      // Criar registro de log inicial
      backupLog = await this.prisma.backupLog.create({
        data: {
          operationType: 'BACKUP',
          status: 'STARTED',
          fileName,
          executedBy: userId,
          ipAddress,
          metadata: {
            includeMetadata: dto.includeMetadata,
            compressionLevel: dto.compressionLevel,
          } as any,
        },
      });

      this.logger.log(`Iniciando backup: ${fileName}`);

      // Enviar progresso inicial
      if (onProgress) {
        onProgress(`Iniciando backup do banco de dados ${dbConfig.database}...`);
      }

      // Registrar auditoria
      await this.auditService.log({
        action: 'BACKUP_STARTED',
        userId,
        ipAddress,
        details: { fileName, backupId: backupLog.id },
      });

      // Executar pg_dump com logging de progresso
      const args = this.getPgDumpArgs(dbConfig, filePath);
      
      this.logger.log('Executando pg_dump...');
      if (onProgress) {
        onProgress('Executando pg_dump - iniciando exportação...');
      }

      await this.executeCommand('pg_dump', args, this.timeout, (progress) => {
        // Log do progresso para debug e envio para frontend
        if (progress.trim()) {
          this.logger.debug(`pg_dump: ${progress.trim()}`);
          if (onProgress) {
            onProgress(progress.trim());
          }
        }
      }, dbConfig.password); // ✅ Passar senha para evitar prompt interativo

      // Verificar se arquivo foi criado
      if (!fs.existsSync(filePath)) {
        throw new Error('Arquivo de backup não foi criado');
      }

      if (onProgress) {
        onProgress('Backup exportado com sucesso, validando arquivo...');
      }

      // Obter tamanho do arquivo
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Validar tamanho
      if (fileSize === 0) {
        throw new Error('Arquivo de backup está vazio');
      }

      // Gerar checksum
      if (onProgress) {
        onProgress('Calculando checksum de integridade...');
      }
      const checksum = await this.calculateChecksum(filePath);

      // Calcular duração
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Atualizar log de backup
      await this.prisma.backupLog.update({
        where: { id: backupLog.id },
        data: {
          status: 'SUCCESS',
          fileSize: BigInt(fileSize),
          completedAt: new Date(),
          durationSeconds,
          metadata: {
            includeMetadata: dto.includeMetadata,
            compressionLevel: dto.compressionLevel,
            checksum,
          } as any,
        },
      });

      // Registrar auditoria de sucesso
      await this.auditService.log({
        action: 'BACKUP_SUCCESS',
        userId,
        ipAddress,
        details: { fileName, backupId: backupLog.id, fileSize, durationSeconds },
      });

      this.logger.log(`Backup criado com sucesso: ${fileName} (${fileSize} bytes)`);

      if (onProgress) {
        onProgress(`Backup finalizado: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
      }

      return {
        backupId: backupLog.id,
        fileName,
        fileSize,
        checksum,
        downloadUrl: `/api/backup/download/${backupLog.id}`,
        createdAt: new Date(),
      };

    } catch (error) {
      this.logger.error(`Erro ao criar backup: ${error.message}`, error.stack);

      // Atualizar log com erro
      if (backupLog) {
        await this.prisma.backupLog.update({
          where: { id: backupLog.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: error.message,
            durationSeconds: Math.floor((Date.now() - startTime) / 1000),
          },
        });

        // Registrar auditoria de falha
        await this.auditService.log({
          action: 'BACKUP_FAILED',
          userId,
          ipAddress,
          details: { error: error.message, backupId: backupLog.id },
        });
      }

      throw new HttpException(
        `Erro ao criar backup: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Faz parse da URL de conexão do banco de dados
   */
  private parseDatabaseUrl(): {
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
  } {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL não configurada');
    }

    try {
      // Formato: postgresql://user:password@host:port/database
      const url = new URL(databaseUrl);
      
      return {
        host: url.hostname,
        port: url.port || '5432',
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove a barra inicial
      };
    } catch (error) {
      throw new Error(`Erro ao fazer parse de DATABASE_URL: ${error.message}`);
    }
  }

  /**
   * Obtém argumentos para pg_dump
   */
  private getPgDumpArgs(
    dbConfig: ReturnType<typeof this.parseDatabaseUrl>,
    filePath: string,
  ): string[] {
    return [
      `--host=${dbConfig.host}`,
      `--port=${dbConfig.port}`,
      `--username=${dbConfig.user}`,
      `--dbname=${dbConfig.database}`,
      '--format=custom',
      '--verbose',
      `--file=${filePath}`,
    ];
  }

  /**
   * Obtém argumentos para pg_restore
   */
  private getPgRestoreArgs(
    dbConfig: ReturnType<typeof this.parseDatabaseUrl>,
    filePath: string,
  ): string[] {
    return [
      `--host=${dbConfig.host}`,
      `--port=${dbConfig.port}`,
      `--username=${dbConfig.user}`,
      `--dbname=${dbConfig.database}`,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      '--verbose',
      filePath,
    ];
  }

  /**
   * Executa comando shell com timeout e callback de progresso de forma segura
   */
  private async executeCommand(
    command: string,
    args: string[],
    timeoutMs: number,
    onProgress?: (data: string) => void,
    password?: string,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      if (password) {
        env.PGPASSWORD = password;
      }

      const childProcess = spawn(command, args, { env });

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        childProcess.kill();
        reject(new Error(`Comando ${command} excedeu o tempo limite de ${timeoutMs}ms`));
      }, timeoutMs);

      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data) => {
          stdout += data.toString();
          if (onProgress) onProgress(data.toString());
        });
      }

      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          stderr += data.toString();
          if (onProgress) onProgress(data.toString());
          this.logger.debug(`[${command}]: ${data.toString().trim()}`);
        });
      }

      childProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Comando ${command} falhou com código ${code}: ${stderr}`));
        }
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Calcula checksum SHA256 de um arquivo
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Obtém caminho do arquivo de backup
   */
  getBackupFilePath(backupId: string): string {
    // Buscar no banco de dados
    return path.join(this.tempDir, backupId);
  }

  /**
   * Lista todos os arquivos de backup disponíveis no diretório
   */
  async listAvailableBackups(): Promise<Array<{
    fileName: string;
    filePath: string;
    fileSize: number;
    createdAt: Date;
    backupId?: string;
  }>> {
    try {
      const files = fs.readdirSync(this.tempDir);
      const backupFiles = files.filter(file => 
        file.endsWith('.dump') || file.endsWith('.sql') || file.endsWith('.backup')
      );

      const backups = backupFiles.map(fileName => {
        const filePath = path.join(this.tempDir, fileName);
        const stats = fs.statSync(filePath);
        
        return {
          fileName,
          filePath,
          fileSize: stats.size,
          createdAt: stats.mtime,
        };
      });

      // Buscar informações do banco de dados para arquivos correspondentes
      const backupsWithInfo = await Promise.all(
        backups.map(async (backup) => {
          const dbBackup = await this.prisma.backupLog.findFirst({
            where: {
              fileName: backup.fileName,
              operationType: 'BACKUP',
            },
            orderBy: { startedAt: 'desc' },
          });

          return {
            ...backup,
            backupId: dbBackup?.id,
          };
        })
      );

      // Ordenar por data de criação (mais recentes primeiro)
      return backupsWithInfo.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      this.logger.error(`Erro ao listar backups: ${error.message}`);
      return [];
    }
  }

  /**
   * Retorna histórico de operações de backup/restore
   */
  async getBackupLogs(
    limit: number = 50,
    operationType?: 'BACKUP' | 'RESTORE',
    status?: 'STARTED' | 'SUCCESS' | 'FAILED' | 'CANCELLED',
  ): Promise<any[]> {
    const logs = await this.prisma.backupLog.findMany({
      where: {
        ...(operationType && { operationType }),
        ...(status && { status }),
      },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return logs.map(log => ({
      id: log.id,
      operationType: log.operationType,
      status: log.status,
      fileName: log.fileName,
      fileSize: log.fileSize ? Number(log.fileSize) : null,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      durationSeconds: log.durationSeconds,
      executedBy: log.user?.name || 'Desconhecido',
      errorMessage: log.errorMessage,
    }));
  }

  /**
   * Obtém informações de um backup específico
   */
  async getBackupInfo(backupId: string): Promise<any> {
    const backup = await this.prisma.backupLog.findUnique({
      where: { id: backupId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!backup) {
      return null;
    }

    return {
      id: backup.id,
      fileName: backup.fileName,
      fileSize: backup.fileSize ? Number(backup.fileSize) : 0,
      status: backup.status,
      createdAt: backup.startedAt,
      executedBy: backup.user?.name,
    };
  }

  /**
   * Valida arquivo de backup antes de restaurar
   */
  async validateBackupFile(file: Express.Multer.File): Promise<{
    valid: boolean;
    info?: any;
    error?: string;
  }> {
    try {
      // Validar extensão
      const validExtensions = ['.sql', '.dump', '.backup'];
      const ext = path.extname(file.originalname).toLowerCase();
      
      if (!validExtensions.includes(ext)) {
        return {
          valid: false,
          error: 'Formato de arquivo inválido. Use .sql, .dump ou .backup',
        };
      }

      // Validar tamanho
      if (file.size > this.maxFileSize) {
        return {
          valid: false,
          error: `Arquivo muito grande. Tamanho máximo: ${this.maxFileSize / 1024 / 1024 / 1024}GB`,
        };
      }

      if (file.size === 0) {
        return {
          valid: false,
          error: 'Arquivo vazio',
        };
      }

      // Detectar formato do arquivo
      let isValid = false;
      let detectedFormat = 'UNKNOWN';

      // Verificar se é formato custom/binário do PostgreSQL
      // Formato custom do pg_dump começa com "PGDMP" (magic number)
      if (ext === '.dump' || ext === '.backup') {
        // Ler primeiros 5 bytes para verificar magic number
        const header = file.buffer.toString('ascii', 0, Math.min(5, file.size));
        
        if (header === 'PGDMP') {
          this.logger.log('✅ Arquivo identificado como PostgreSQL custom format (binário)');
          isValid = true;
          detectedFormat = 'CUSTOM';
        } else {
          // Tentar ler como texto (pode ser dump em formato plain)
          try {
            const content = file.buffer.toString('utf8', 0, Math.min(1000, file.size));
            const isPgDump = content.includes('PostgreSQL') || 
                            content.includes('pg_dump') ||
                            content.includes('CREATE TABLE') ||
                            content.includes('COPY ');
            
            if (isPgDump) {
              this.logger.log('✅ Arquivo identificado como PostgreSQL plain format (texto)');
              isValid = true;
              detectedFormat = 'PLAIN';
            }
          } catch (err) {
            this.logger.warn('Não foi possível ler arquivo como texto');
          }
        }
      } 
      // Arquivos .sql devem ser texto puro
      else if (ext === '.sql') {
        try {
          const content = file.buffer.toString('utf8', 0, Math.min(1000, file.size));
          const isPgDump = content.includes('PostgreSQL') || 
                          content.includes('pg_dump') ||
                          content.includes('CREATE TABLE') ||
                          content.includes('INSERT INTO') ||
                          content.includes('COPY ');
          
          if (isPgDump) {
            this.logger.log('✅ Arquivo SQL identificado como backup PostgreSQL');
            isValid = true;
            detectedFormat = 'SQL';
          }
        } catch (err) {
          this.logger.error('Erro ao ler arquivo SQL', err);
        }
      }

      if (!isValid) {
        return {
          valid: false,
          error: 'Arquivo não parece ser um backup PostgreSQL válido. Verifique o formato.',
        };
      }

      return {
        valid: true,
        info: {
          format: detectedFormat,
          extension: ext.replace('.', '').toUpperCase(),
          size: file.size,
          fileName: file.originalname,
        },
      };
    } catch (error) {
      this.logger.error(`Erro ao validar arquivo: ${error.message}`);
      return {
        valid: false,
        error: `Erro na validação: ${error.message}`,
      };
    }
  }

  /**
   * Restaura banco de dados a partir de arquivo de backup
   */
  async restoreBackup(
    file: Express.Multer.File,
    userId: string,
    ipAddress?: string,
  ): Promise<{
    restoreId: string;
    fileName: string;
    durationSeconds: number;
    completedAt: Date;
  }> {
    const startTime = Date.now();
    let restoreLog: any;
    let backupSafetyFile: string | null = null;

    try {
      // Validar userId
      if (!userId) {
        throw new Error('UserId é obrigatório para executar restore');
      }

      // Validar arquivo primeiro
      const validation = await this.validateBackupFile(file);
      if (!validation.valid) {
        throw new Error(validation.error || 'Arquivo inválido');
      }

      // Extrair credenciais do DATABASE_URL
      const dbConfig = this.parseDatabaseUrl();

      // Salvar arquivo temporariamente
      const tempFileName = `restore_${Date.now()}_${file.originalname}`;
      const tempFilePath = path.join(this.tempDir, tempFileName);
      fs.writeFileSync(tempFilePath, file.buffer);

      // Criar registro de log inicial
      restoreLog = await this.prisma.backupLog.create({
        data: {
          operationType: 'RESTORE',
          status: 'STARTED',
          fileName: file.originalname,
          fileSize: BigInt(file.size),
          executedBy: userId,
          ipAddress,
          metadata: {
            originalFileName: file.originalname,
            fileSize: file.size,
          } as any,
        },
      });

      this.logger.log(`Iniciando restore: ${file.originalname}`);

      // Registrar auditoria
      await this.auditService.log({
        action: 'RESTORE_STARTED',
        userId,
        ipAddress,
        details: { fileName: file.originalname, restoreId: restoreLog.id },
      });

      // Criar backup de segurança antes do restore
      this.logger.log('Criando backup de segurança...');
      const safetyBackupName = `safety_backup_${Date.now()}.dump`;
      backupSafetyFile = path.join(this.tempDir, safetyBackupName);
      
      const safetyArgs = this.getPgDumpArgs(dbConfig, backupSafetyFile);
      await this.executeCommand('pg_dump', safetyArgs, this.timeout, null, dbConfig.password);
      this.logger.log('Backup de segurança criado');

      // Executar pg_restore
      this.logger.log('Executando restore...');
      const restoreArgs = this.getPgRestoreArgs(dbConfig, tempFilePath);
      await this.executeCommand('pg_restore', restoreArgs, this.timeout, (progress) => {
        // Log do progresso para debug
        if (progress.trim()) {
          this.logger.debug(`pg_restore: ${progress.trim()}`);
        }
      }, dbConfig.password);

      // Calcular duração
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Atualizar log de restore com proteção contra deleção pelo --clean
      try {
        await this.prisma.backupLog.update({
          where: { id: restoreLog.id },
          data: {
            status: 'SUCCESS',
            completedAt: new Date(),
            durationSeconds,
          },
        });
      } catch (updateError) {
        // Se o log foi deletado pelo pg_restore --clean, criar novo
        this.logger.warn(`Log foi deletado durante restore, recriando: ${updateError.message}`);
        try {
          restoreLog = await this.prisma.backupLog.create({
            data: {
              operationType: 'RESTORE',
              status: 'SUCCESS',
              fileName: file.originalname,
              fileSize: BigInt(file.size),
              executedBy: userId,
              ipAddress,
              startedAt: new Date(startTime),
              completedAt: new Date(),
              durationSeconds,
              metadata: {
                originalFileName: file.originalname,
                fileSize: file.size,
                recreated: true, // Indica que foi recriado
              } as any,
            },
          });
        } catch (createError) {
          this.logger.error(`Erro ao recriar log: ${createError.message}`);
          // Continua mesmo se não conseguir criar o log
        }
      }

      // Registrar auditoria de sucesso
      await this.auditService.log({
        action: 'RESTORE_SUCCESS',
        userId,
        ipAddress,
        details: { fileName: file.originalname, restoreId: restoreLog.id, durationSeconds },
      });

      this.logger.log(`Restore concluído com sucesso: ${file.originalname}`);

      // Limpar arquivos temporários
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      if (backupSafetyFile && fs.existsSync(backupSafetyFile)) {
        // Manter backup de segurança por algumas horas
        setTimeout(() => {
          if (fs.existsSync(backupSafetyFile)) {
            fs.unlinkSync(backupSafetyFile);
          }
        }, 3 * 60 * 60 * 1000); // 3 horas
      }

      return {
        restoreId: restoreLog.id,
        fileName: file.originalname,
        durationSeconds,
        completedAt: new Date(),
      };

    } catch (error) {
      this.logger.error(`Erro ao executar restore: ${error.message}`, error.stack);

      // Atualizar ou criar log com erro
      try {
        if (restoreLog?.id) {
          // Tentar atualizar o log existente
          try {
            await this.prisma.backupLog.update({
              where: { id: restoreLog.id },
              data: {
                status: 'FAILED',
                completedAt: new Date(),
                errorMessage: error.message,
                durationSeconds: Math.floor((Date.now() - startTime) / 1000),
              },
            });
          } catch (updateError) {
            // Se o update falhar (registro não encontrado), criar um novo
            this.logger.warn(`Log não encontrado, criando novo: ${updateError.message}`);
            await this.prisma.backupLog.create({
              data: {
                operationType: 'RESTORE',
                status: 'FAILED',
                fileName: file?.originalname || 'unknown',
                fileSize: BigInt(file?.size || 0),
                executedBy: userId,
                ipAddress,
                completedAt: new Date(),
                errorMessage: error.message,
                durationSeconds: Math.floor((Date.now() - startTime) / 1000),
              },
            });
          }

          // Registrar auditoria de falha
          await this.auditService.log({
            action: 'RESTORE_FAILED',
            userId,
            ipAddress,
            details: { error: error.message, restoreId: restoreLog.id },
          });
        }
      } catch (logError) {
        this.logger.error(`Erro ao registrar falha no log: ${logError.message}`);
      }

      throw new Error(`Erro ao executar restore: ${error.message}`);
    }
  }

  /**
   * Constrói comando pg_restore
   */
  private buildPgRestoreCommand(
    dbConfig: ReturnType<typeof this.parseDatabaseUrl>,
    filePath: string,
  ): string {
    // --clean remove objetos antes de recriar
    // --if-exists usa IF EXISTS ao remover objetos
    // --no-owner não tenta recriar ownership
    // --no-acl não restaura privilégios de acesso
    return `pg_restore --host=${dbConfig.host} --port=${dbConfig.port} --username=${dbConfig.user} --dbname=${dbConfig.database} --clean --if-exists --no-owner --no-acl --verbose "${filePath}"`;
  }

  /**
   * Apaga um arquivo de backup
   */
  async deleteBackup(
    fileName: string,
    userId: string,
  ): Promise<{ fileName: string; deleted: boolean }> {
    try {
      // Validar nome do arquivo (segurança)
      if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
        throw new HttpException(
          'Nome de arquivo inválido',
          HttpStatus.BAD_REQUEST,
        );
      }

      const filePath = path.join(this.tempDir, fileName);

      // Verificar se arquivo existe
      if (!fs.existsSync(filePath)) {
        throw new HttpException(
          'Arquivo de backup não encontrado',
          HttpStatus.NOT_FOUND,
        );
      }

      // Apagar arquivo do sistema de arquivos
      fs.unlinkSync(filePath);

      this.logger.log(`Backup apagado: ${fileName} por usuário ${userId}`);

      // Registrar auditoria
      await this.auditService.log({
        action: 'BACKUP_DELETED',
        userId,
        details: { fileName },
      });

      return {
        fileName,
        deleted: true,
      };
    } catch (error) {
      this.logger.error(`Erro ao apagar backup: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Erro ao apagar backup: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Limpa arquivos temporários antigos
   */
  async cleanupOldBackups(retentionHours: number = 1): Promise<void> {
    const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

    try {
      const files = fs.readdirSync(this.tempDir);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile() && stats.mtime < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
          this.logger.log(`Arquivo temporário removido: ${file}`);
        }
      }

      if (deletedCount > 0) {
        this.logger.log(`Limpeza concluída: ${deletedCount} arquivo(s) removido(s)`);
      }
    } catch (error) {
      this.logger.error(`Erro ao limpar arquivos temporários: ${error.message}`);
    }
  }
}
