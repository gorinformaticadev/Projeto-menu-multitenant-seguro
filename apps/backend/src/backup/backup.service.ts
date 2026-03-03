import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BackupArtifact,
  BackupArtifactSource,
  BackupJob,
  BackupJobStatus,
  BackupJobType,
  Role,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../core/prisma/prisma.service';
import { BackupConfigService } from './backup-config.service';
import { BackupProcessService } from './backup-process.service';
import { BackupRuntimeStateService } from './backup-runtime-state.service';
import { RestoreJobDto } from './dto/restore-job.dto';

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

interface JobLogEntry {
  at: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface BackupListResponse {
  artifacts: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    source: BackupArtifactSource;
    checksumSha256: string;
    createdAt: Date;
    metadata: Record<string, unknown> | null;
  }>;
  jobs: Array<{
    id: string;
    type: BackupJobType;
    status: BackupJobStatus;
    progressPercent: number;
    currentStep: string | null;
    fileName: string | null;
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
    error: string | null;
    createdByUserId: string | null;
    artifactId: string | null;
  }>;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly archiveMagic = Buffer.from('PGDMP', 'ascii');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly backupConfig: BackupConfigService,
    private readonly processService: BackupProcessService,
    private readonly runtimeState: BackupRuntimeStateService,
  ) {}

  getUploadMaxSizeBytes(): number {
    return this.backupConfig.getMaxUploadBytes();
  }

  getBackupDir(): string {
    return this.backupConfig.getBackupDir();
  }

  getMaintenanceState() {
    return this.runtimeState.getState();
  }

  async createBackupJob(userId: string, context: RequestContext): Promise<BackupJob> {
    await this.assertOperatorAllowed(userId);
    await this.assertNoRunningUpdate();

    const job = await this.prisma.backupJob.create({
      data: {
        type: BackupJobType.BACKUP,
        status: BackupJobStatus.PENDING,
        progressPercent: 0,
        currentStep: 'QUEUED',
        createdByUserId: userId,
        metadata: {
          requestedBy: userId,
          source: 'api',
          executionMode: this.backupConfig.getExecutionMode(),
        },
        logs: [],
      },
    });

    await this.auditService.log({
      action: 'BACKUP_JOB_CREATED',
      userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { jobId: job.id, type: job.type },
    });

    return job;
  }

  async uploadBackup(
    file: Express.Multer.File,
    userId: string,
    context: RequestContext,
  ): Promise<BackupArtifact> {
    await this.assertOperatorAllowed(userId);

    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException('Arquivo de backup vazio ou nao enviado');
    }

    this.validateUploadedBackup(file);

    const extension = path.extname(file.originalname || '').toLowerCase();
    const generatedName = this.buildStoredFileName(`upload_${Date.now()}`, extension);
    const filePath = this.resolveFilePath(generatedName);

    fs.writeFileSync(filePath, file.buffer, { flag: 'wx' });
    const checksumSha256 = this.calculateChecksumFromBuffer(file.buffer);

    const artifact = await this.prisma.backupArtifact.create({
      data: {
        fileName: generatedName,
        filePath,
        sizeBytes: BigInt(file.size),
        checksumSha256,
        source: BackupArtifactSource.UPLOAD,
        createdByUserId: userId,
        metadata: {
          originalName: file.originalname,
          environmentScope: null,
          executionMode: this.backupConfig.getExecutionMode(),
        },
      },
    });

    await this.appendArtifactAudit('BACKUP_UPLOAD_STORED', artifact, userId, context);

    return artifact;
  }

  async queueRestoreFromArtifact(
    artifactId: string,
    userId: string,
    restoreOptions: RestoreJobDto,
    context: RequestContext,
  ): Promise<BackupJob> {
    await this.assertOperatorAllowed(userId);
    await this.assertNoRunningUpdate();

    const artifact = await this.getArtifactByIdOrThrow(artifactId);
    this.assertArtifactUsableForRestore(artifact, restoreOptions);

    const job = await this.prisma.backupJob.create({
      data: {
        type: BackupJobType.RESTORE,
        status: BackupJobStatus.PENDING,
        currentStep: 'QUEUED',
        progressPercent: 0,
        artifactId: artifact.id,
        fileName: artifact.fileName,
        filePath: artifact.filePath,
        sizeBytes: artifact.sizeBytes,
        checksumSha256: artifact.checksumSha256,
        createdByUserId: userId,
        metadata: {
          runMigrations: !!restoreOptions.runMigrations,
          forceCrossEnvironment: !!restoreOptions.forceCrossEnvironment,
          allowUnsafeObjects: !!restoreOptions.allowUnsafeObjects,
          reason: restoreOptions.reason || null,
          environmentScope: this.backupConfig.getEnvironmentScope(),
        },
        logs: [],
      },
    });

    await this.auditService.log({
      action: 'RESTORE_JOB_CREATED',
      userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { jobId: job.id, artifactId: artifact.id, fileName: artifact.fileName },
    });

    return job;
  }

  async queueRestoreFromUpload(
    uploadId: string,
    userId: string,
    restoreOptions: RestoreJobDto,
    context: RequestContext,
  ): Promise<BackupJob> {
    const artifact = await this.getArtifactByIdOrThrow(uploadId);
    if (artifact.source !== BackupArtifactSource.UPLOAD) {
      throw new BadRequestException('O artefato informado nao e um upload de backup');
    }
    return this.queueRestoreFromArtifact(uploadId, userId, restoreOptions, context);
  }

  async listBackupsAndJobs(limit = 50): Promise<BackupListResponse> {
    const safeLimit = Math.max(1, Math.min(limit, 200));

    const [artifacts, jobs] = await Promise.all([
      this.prisma.backupArtifact.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
      }),
      this.prisma.backupJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
      }),
    ]);

    return {
      artifacts: artifacts.map((artifact) => ({
        id: artifact.id,
        fileName: artifact.fileName,
        fileSize: Number(artifact.sizeBytes),
        source: artifact.source,
        checksumSha256: artifact.checksumSha256,
        createdAt: artifact.createdAt,
        metadata: this.toJsonRecord(artifact.metadata),
      })),
      jobs: jobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        progressPercent: job.progressPercent,
        currentStep: job.currentStep,
        fileName: job.fileName,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        error: job.error,
        createdByUserId: job.createdByUserId,
        artifactId: job.artifactId,
      })),
    };
  }

  async listAvailableArtifacts(limit = 100): Promise<BackupArtifact[]> {
    return await this.prisma.backupArtifact.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
    });
  }

  async getJobStatus(jobId: string): Promise<BackupJob> {
    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Job nao encontrado');
    }
    return job;
  }

  async cancelPendingJob(jobId: string, userId: string): Promise<BackupJob> {
    await this.assertOperatorAllowed(userId);

    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Job nao encontrado');
    }

    if (job.status === BackupJobStatus.SUCCESS || job.status === BackupJobStatus.FAILED) {
      throw new ConflictException('Job finalizado e nao pode ser cancelado');
    }

    const updated = await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupJobStatus.CANCELED,
        cancelRequested: true,
        finishedAt: new Date(),
        currentStep: 'CANCELED',
      },
    });

    await this.appendJobLog(jobId, 'WARN', 'Job cancelado pelo operador');
    return updated;
  }

  async deleteArtifactByFileName(fileName: string, userId: string): Promise<void> {
    await this.assertOperatorAllowed(userId);

    const artifact = await this.prisma.backupArtifact.findFirst({
      where: { fileName, deletedAt: null },
    });

    if (!artifact) {
      throw new NotFoundException('Backup nao encontrado');
    }

    const activeJob = await this.prisma.backupJob.findFirst({
      where: {
        artifactId: artifact.id,
        status: { in: [BackupJobStatus.PENDING, BackupJobStatus.RUNNING] },
      },
    });

    if (activeJob) {
      throw new ConflictException('Existe job ativo utilizando este backup');
    }

    this.deleteFileIfExists(artifact.filePath);

    await this.prisma.backupArtifact.update({
      where: { id: artifact.id },
      data: { deletedAt: new Date() },
    });
  }

  async resolveArtifactDownload(
    artifactId: string,
  ): Promise<{ fileName: string; filePath: string; size: number }> {
    const artifact = await this.getArtifactByIdOrThrow(artifactId);
    if (artifact.deletedAt) {
      throw new NotFoundException('Backup removido');
    }
    this.assertSafeFilePath(artifact.filePath);
    if (!fs.existsSync(artifact.filePath)) {
      throw new NotFoundException('Arquivo de backup nao encontrado no disco');
    }

    const stats = fs.statSync(artifact.filePath);
    return {
      fileName: artifact.fileName,
      filePath: artifact.filePath,
      size: stats.size,
    };
  }

  async resolveArtifactByFileName(
    fileName: string,
  ): Promise<{ fileName: string; filePath: string; size: number }> {
    const safeName = this.normalizeFileName(fileName);
    const artifact = await this.prisma.backupArtifact.findFirst({
      where: { fileName: safeName, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!artifact) {
      throw new NotFoundException('Backup nao encontrado');
    }
    return this.resolveArtifactDownload(artifact.id);
  }

  async findArtifactByFileName(fileName: string): Promise<BackupArtifact> {
    const safeName = this.normalizeFileName(fileName);
    const artifact = await this.prisma.backupArtifact.findFirst({
      where: { fileName: safeName, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!artifact) {
      throw new NotFoundException('Backup nao encontrado');
    }
    return artifact;
  }

  async listLegacyLogs(limit = 50): Promise<any[]> {
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const jobs = await this.prisma.backupJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });

    return jobs.map((job) => ({
      id: job.id,
      operationType: job.type,
      status: job.status,
      fileName: job.fileName,
      fileSize: job.sizeBytes ? Number(job.sizeBytes) : null,
      startedAt: job.startedAt || job.createdAt,
      completedAt: job.finishedAt,
      durationSeconds:
        job.startedAt && job.finishedAt
          ? Math.max(0, Math.floor((job.finishedAt.getTime() - job.startedAt.getTime()) / 1000))
          : null,
      executedBy: job.createdByUserId || 'system',
      errorMessage: job.error,
    }));
  }

  async claimNextPendingJob(): Promise<BackupJob | null> {
    const pending = await this.prisma.backupJob.findFirst({
      where: {
        status: BackupJobStatus.PENDING,
        cancelRequested: false,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!pending) {
      return null;
    }

    const claim = await this.prisma.backupJob.updateMany({
      where: {
        id: pending.id,
        status: BackupJobStatus.PENDING,
        cancelRequested: false,
      },
      data: {
        status: BackupJobStatus.RUNNING,
        startedAt: new Date(),
        currentStep: 'CLAIMED',
      },
    });

    if (claim.count !== 1) {
      return null;
    }

    return this.prisma.backupJob.findUnique({ where: { id: pending.id } });
  }

  async returnJobToPending(jobId: string, reason: string): Promise<void> {
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupJobStatus.PENDING,
        currentStep: 'WAITING_LOCK',
      },
    });

    await this.appendJobLog(jobId, 'INFO', reason);
  }

  async markJobSuccess(jobId: string, details: Partial<BackupJob> = {}): Promise<void> {
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupJobStatus.SUCCESS,
        progressPercent: 100,
        currentStep: 'COMPLETED',
        finishedAt: new Date(),
        ...details,
      },
    });
  }

  async markJobFailed(jobId: string, error: unknown): Promise<void> {
    const message = this.errorMessage(error);
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupJobStatus.FAILED,
        finishedAt: new Date(),
        currentStep: 'FAILED',
        error: message,
      },
    });

    await this.appendJobLog(jobId, 'ERROR', message);
    await this.notifyFailure(jobId, message);
  }

  async markJobCanceled(jobId: string, reason: string): Promise<void> {
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupJobStatus.CANCELED,
        finishedAt: new Date(),
        currentStep: 'CANCELED',
        error: reason,
      },
    });

    await this.appendJobLog(jobId, 'WARN', reason);
  }

  async heartbeat(jobId: string): Promise<void> {
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: { updatedAt: new Date() },
    });
  }

  async updateJobProgress(
    jobId: string,
    step: string,
    progressPercent: number,
    message?: string,
    level: JobLogEntry['level'] = 'INFO',
  ): Promise<void> {
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        currentStep: step,
        progressPercent: Math.max(0, Math.min(100, Math.round(progressPercent))),
      },
    });

    if (message) {
      await this.appendJobLog(jobId, level, message);
    }
  }

  async executeJob(jobId: string): Promise<void> {
    const job = await this.prisma.backupJob.findUnique({
      where: { id: jobId },
      include: { artifact: true },
    });

    if (!job) {
      throw new NotFoundException('Job nao encontrado para execucao');
    }

    if (job.cancelRequested || job.status === BackupJobStatus.CANCELED) {
      await this.markJobCanceled(job.id, 'Job cancelado antes da execucao');
      return;
    }

    if (job.type === BackupJobType.BACKUP) {
      await this.runBackupJob(job);
      return;
    }

    await this.runRestoreJob(job);
  }

  async appendJobLog(jobId: string, level: JobLogEntry['level'], message: string): Promise<void> {
    const job = await this.prisma.backupJob.findUnique({
      where: { id: jobId },
      select: { logs: true },
    });

    const currentLogs = this.parseLogs(job?.logs);
    currentLogs.push({
      at: new Date().toISOString(),
      level,
      message: message.slice(0, 4000),
    });

    const trimmed = currentLogs.slice(-400);

    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        logs: trimmed as any,
      },
    });
  }

  private async tryAppendJobLog(jobId: string, level: JobLogEntry['level'], message: string): Promise<void> {
    try {
      await this.appendJobLog(jobId, level, message);
    } catch (error) {
      this.logger.warn(`Falha ao registrar log do job ${jobId}: ${String(error)}`);
    }
  }

  async applyRetentionPolicy(): Promise<void> {
    const retention = this.backupConfig.getRetentionCount();
    const artifacts = await this.prisma.backupArtifact.findMany({
      where: {
        source: BackupArtifactSource.BACKUP,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    const stale = artifacts.slice(retention);
    for (const artifact of stale) {
      const inUse = await this.prisma.backupJob.findFirst({
        where: {
          artifactId: artifact.id,
          status: { in: [BackupJobStatus.PENDING, BackupJobStatus.RUNNING] },
        },
      });

      if (inUse) {
        continue;
      }

      this.deleteFileIfExists(artifact.filePath);
      await this.prisma.backupArtifact.update({
        where: { id: artifact.id },
        data: { deletedAt: new Date() },
      });
    }
  }

  private async runBackupJob(job: BackupJob): Promise<void> {
    await this.assertNoRunningUpdate();

    const db = this.backupConfig.getDatabaseConfig();
    const extension = '.dump';
    const fileName = this.buildStoredFileName(`backup_${Date.now()}`, extension);
    const filePath = this.resolveFilePath(fileName);

    await this.updateJobProgress(job.id, 'BACKUP_PREPARING', 5, 'Preparando comando pg_dump');

    const args = [
      '--format=custom',
      '--compress=6',
      '--no-owner',
      '--no-privileges',
      '--verbose',
      '--host',
      db.host,
      '--port',
      String(db.port),
      '--username',
      db.user,
      '--dbname',
      db.database,
      '--file',
      filePath,
      '--lock-wait-timeout=30000',
    ];

    const env = this.buildCommandEnv(db.password);

    await this.updateJobProgress(job.id, 'BACKUP_RUNNING', 35, 'Executando pg_dump');

    await this.processService.runCommand({
      command: this.backupConfig.getBinary('pg_dump'),
      args,
      env,
      timeoutMs: this.backupConfig.getJobTimeoutMs(),
      cwd: this.backupConfig.getProjectRoot(),
      onStderrLine: async (line) => {
        if (/dumping|reading|finished/i.test(line)) {
          await this.appendJobLog(job.id, 'INFO', line);
        }
      },
    });

    if (!fs.existsSync(filePath)) {
      throw new Error('Arquivo de backup nao foi criado');
    }

    const size = fs.statSync(filePath).size;
    if (size <= 0) {
      throw new Error('Arquivo de backup gerado sem conteudo');
    }

    await this.updateJobProgress(job.id, 'BACKUP_CHECKSUM', 80, 'Calculando checksum SHA256');
    const checksum = await this.calculateChecksumFromFile(filePath);

    const artifact = await this.prisma.backupArtifact.create({
      data: {
        fileName,
        filePath,
        sizeBytes: BigInt(size),
        checksumSha256: checksum,
        source: BackupArtifactSource.BACKUP,
        createdByUserId: job.createdByUserId,
        metadata: {
          environmentScope: this.backupConfig.getEnvironmentScope(),
          executionMode: this.backupConfig.getExecutionMode(),
        },
      },
    });

    await this.markJobSuccess(job.id, {
      artifactId: artifact.id,
      fileName,
      filePath,
      sizeBytes: BigInt(size),
      checksumSha256: checksum,
    });

    await this.appendJobLog(job.id, 'INFO', `Backup concluido: ${fileName}`);

    await this.auditService.log({
      action: 'BACKUP_JOB_SUCCESS',
      userId: job.createdByUserId || undefined,
      details: {
        jobId: job.id,
        artifactId: artifact.id,
        fileName,
        fileSize: size,
      },
    });

    await this.applyRetentionPolicy();
  }

  private async runRestoreJob(
    job: BackupJob & {
      artifact?: BackupArtifact | null;
    },
  ): Promise<void> {
    await this.assertNoRunningUpdate();

    const artifact = job.artifact || (job.artifactId ? await this.getArtifactByIdOrThrow(job.artifactId) : null);
    if (!artifact) {
      throw new Error('Artefato de restore nao encontrado');
    }

    this.assertSafeFilePath(artifact.filePath);
    if (!fs.existsSync(artifact.filePath)) {
      throw new Error('Arquivo de restore nao encontrado no disco');
    }

    await this.updateJobProgress(job.id, 'RESTORE_VALIDATING_FILE', 10, 'Validando integridade do arquivo');

    const checksum = await this.calculateChecksumFromFile(artifact.filePath);
    if (checksum !== artifact.checksumSha256) {
      throw new Error('Checksum do arquivo diverge do checksum registrado');
    }

    await this.validateDumpArchiveSignatureFromFile(artifact.filePath);

    const db = this.backupConfig.getDatabaseConfig();
    const stagingDatabase = this.backupConfig.buildStagingDatabaseName(job.id);
    const metadata = this.toJsonRecord(job.metadata);

    await this.updateJobProgress(job.id, 'RESTORE_STAGE_DB_PREPARE', 20, 'Preparando banco staging');
    await this.recreateDatabase(stagingDatabase, db.password);

    const restoreListPath = await this.buildFilteredRestoreList({
      dumpPath: artifact.filePath,
      jobId: job.id,
      password: db.password,
      artifactSource: artifact.source,
      allowUnsafeObjects: metadata?.allowUnsafeObjects === true,
    });

    let rollbackRestoreListPath: string | undefined;

    try {
      await this.updateJobProgress(job.id, 'RESTORE_STAGE_DB_LOAD', 40, 'Restaurando dump no banco staging');
      await this.executePgRestore({
        dbName: stagingDatabase,
        dumpPath: artifact.filePath,
        listFilePath: restoreListPath,
        password: db.password,
        onLine: async (line) => {
          if (/processing item|creating|loading data|setting|finished/i.test(line)) {
            await this.appendJobLog(job.id, 'INFO', line);
          }
        },
      });

      await this.updateJobProgress(job.id, 'RESTORE_STAGE_DB_VALIDATE', 55, 'Validando banco staging');
      await this.validateStagingDatabase(stagingDatabase, db.password);

      await this.updateJobProgress(job.id, 'RESTORE_SAFETY_BACKUP', 70, 'Criando backup de seguranca pre-restore');
      const safety = await this.createSafetyBackup(job, db.password);
      rollbackRestoreListPath = await this.buildFilteredRestoreList({
        dumpPath: safety.filePath,
        jobId: `${job.id}_rollback`,
        password: db.password,
        artifactSource: safety.source,
        allowUnsafeObjects: true,
      });

      await this.updateJobProgress(job.id, 'RESTORE_ENTER_MAINTENANCE', 80, 'Ativando modo manutencao');
      this.runtimeState.enableMaintenance(job.id, 'restore-cutover');

      try {
        const cutoverTimeoutMs = Math.min(
          this.backupConfig.getJobTimeoutMs(),
          this.backupConfig.getRestoreMaintenanceWindowSeconds() * 1000,
        );

        await this.updateJobProgress(job.id, 'RESTORE_CUTOVER', 90, 'Aplicando restore no banco principal');
        try {
          await this.executePgRestore({
            dbName: db.database,
            dumpPath: artifact.filePath,
            listFilePath: restoreListPath,
            password: db.password,
            timeoutMs: cutoverTimeoutMs,
            onLine: async (line) => {
              if (/processing item|creating|loading data|setting|finished/i.test(line)) {
                await this.tryAppendJobLog(job.id, 'INFO', line);
              }
            },
          });
        } catch (cutoverError) {
          await this.tryAppendJobLog(job.id, 'ERROR', `Falha no cutover: ${this.errorMessage(cutoverError)}`);
          await this.tryAppendJobLog(job.id, 'WARN', 'Iniciando rollback automatico com safety backup');

          let rollbackError: unknown = null;
          try {
            await this.executePgRestore({
              dbName: db.database,
              dumpPath: safety.filePath,
              listFilePath: rollbackRestoreListPath,
              password: db.password,
              timeoutMs: cutoverTimeoutMs,
              onLine: async (line) => {
                if (/processing item|creating|loading data|setting|finished/i.test(line)) {
                  await this.tryAppendJobLog(job.id, 'INFO', `[rollback] ${line}`);
                }
              },
            });
            await this.tryAppendJobLog(job.id, 'INFO', 'Rollback automatico concluido com sucesso');
          } catch (error) {
            rollbackError = error;
            await this.tryAppendJobLog(
              job.id,
              'ERROR',
              `Rollback automatico falhou: ${this.errorMessage(rollbackError)}`,
            );
          }

          let reconnectError: unknown = null;
          try {
            await this.ensurePrismaConnectionHealthy();
          } catch (error) {
            reconnectError = error;
            await this.tryAppendJobLog(job.id, 'ERROR', `Falha ao recuperar conexao Prisma: ${this.errorMessage(error)}`);
          }

          throw this.wrapRestoreCutoverError(cutoverError, rollbackError, reconnectError);
        }

        await this.ensurePrismaConnectionHealthy();
      } finally {
        this.runtimeState.disableMaintenance(job.id);
      }

      if (metadata?.runMigrations === true) {
        await this.updateJobProgress(job.id, 'RESTORE_MIGRATIONS', 95, 'Executando migrate deploy');
        await this.runPostRestoreMigrations(db.password);
      }

      await this.updateJobProgress(job.id, 'RESTORE_CLEANUP', 98, 'Limpando banco staging');
      await this.dropDatabase(stagingDatabase, db.password);

      await this.markJobSuccess(job.id, {
        fileName: artifact.fileName,
        filePath: artifact.filePath,
        sizeBytes: artifact.sizeBytes,
        checksumSha256: artifact.checksumSha256,
        metadata: {
          ...(this.toJsonRecord(job.metadata) || {}),
          safetyBackupArtifactId: safety.id,
          stagingDatabase,
        } as any,
      });

      await this.auditService.log({
        action: 'RESTORE_JOB_SUCCESS',
        userId: job.createdByUserId || undefined,
        details: {
          jobId: job.id,
          artifactId: artifact.id,
          fileName: artifact.fileName,
          stagingDatabase,
          safetyBackupArtifactId: safety.id,
        },
      });
    } finally {
      this.runtimeState.disableMaintenance(job.id);
      if (restoreListPath) {
        this.deleteFileIfExists(restoreListPath);
      }
      if (rollbackRestoreListPath) {
        this.deleteFileIfExists(rollbackRestoreListPath);
      }
      await this.dropDatabase(stagingDatabase, db.password, true);
    }
  }

  private async createSafetyBackup(job: BackupJob, password: string): Promise<BackupArtifact> {
    const db = this.backupConfig.getDatabaseConfig();
    const fileName = this.buildStoredFileName(`safety_pre_restore_${Date.now()}`, '.dump');
    const filePath = this.resolveFilePath(fileName);

    const args = [
      '--format=custom',
      '--compress=6',
      '--no-owner',
      '--no-privileges',
      '--host',
      db.host,
      '--port',
      String(db.port),
      '--username',
      db.user,
      '--dbname',
      db.database,
      '--file',
      filePath,
    ];

    await this.processService.runCommand({
      command: this.backupConfig.getBinary('pg_dump'),
      args,
      env: this.buildCommandEnv(password),
      timeoutMs: this.backupConfig.getJobTimeoutMs(),
      cwd: this.backupConfig.getProjectRoot(),
    });

    const stats = fs.statSync(filePath);
    const checksumSha256 = await this.calculateChecksumFromFile(filePath);

    return await this.prisma.backupArtifact.create({
      data: {
        fileName,
        filePath,
        sizeBytes: BigInt(stats.size),
        checksumSha256,
        source: BackupArtifactSource.SAFETY,
        createdByUserId: job.createdByUserId,
        metadata: {
          sourceJobId: job.id,
          createdAt: new Date().toISOString(),
        },
      },
    });
  }

  private async executePgRestore(params: {
    dbName: string;
    dumpPath: string;
    listFilePath?: string;
    password: string;
    timeoutMs?: number;
    onLine?: (line: string) => Promise<void>;
  }): Promise<void> {
    const db = this.backupConfig.getDatabaseConfig();

    const args = [
      '--verbose',
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '--exit-on-error',
      '--host',
      db.host,
      '--port',
      String(db.port),
      '--username',
      db.user,
      '--dbname',
      params.dbName,
    ];

    if (params.listFilePath) {
      args.push('--use-list', params.listFilePath);
    }

    args.push(params.dumpPath);

    await this.processService.runCommand({
      command: this.backupConfig.getBinary('pg_restore'),
      args,
      env: this.buildCommandEnv(params.password),
      timeoutMs: params.timeoutMs || this.backupConfig.getJobTimeoutMs(),
      cwd: this.backupConfig.getProjectRoot(),
      onStderrLine: (line) => {
        void params.onLine?.(line);
      },
      onStdoutLine: (line) => {
        void params.onLine?.(line);
      },
    });
  }

  private async validateStagingDatabase(database: string, password: string): Promise<void> {
    const db = this.backupConfig.getDatabaseConfig();
    const args = [
      '--host',
      db.host,
      '--port',
      String(db.port),
      '--username',
      db.user,
      '--dbname',
      database,
      '--tuples-only',
      '--no-align',
      '--command',
      "SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public';",
    ];

    const result = await this.processService.runCommand({
      command: this.backupConfig.getBinary('psql'),
      args,
      env: this.buildCommandEnv(password),
      timeoutMs: Math.min(this.backupConfig.getJobTimeoutMs(), 120000),
      cwd: this.backupConfig.getProjectRoot(),
    });

    const parsedCount = Number((result.stdout || '').trim());
    if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
      throw new Error('Banco staging restaurado sem tabelas no schema public');
    }
  }

  private async recreateDatabase(database: string, password: string): Promise<void> {
    await this.dropDatabase(database, password, true);

    const db = this.backupConfig.getDatabaseConfig();
    const args = [
      '--host',
      db.host,
      '--port',
      String(db.port),
      '--username',
      db.user,
      database,
    ];

    await this.processService.runCommand({
      command: this.backupConfig.getBinary('createdb'),
      args,
      env: this.buildCommandEnv(password),
      timeoutMs: Math.min(this.backupConfig.getJobTimeoutMs(), 180000),
      cwd: this.backupConfig.getProjectRoot(),
    });
  }

  private async dropDatabase(database: string, password: string, ignoreMissing = false): Promise<void> {
    const db = this.backupConfig.getDatabaseConfig();
    const args = [
      '--if-exists',
      '--host',
      db.host,
      '--port',
      String(db.port),
      '--username',
      db.user,
      database,
    ];

    try {
      await this.processService.runCommand({
        command: this.backupConfig.getBinary('dropdb'),
        args,
        env: this.buildCommandEnv(password),
        timeoutMs: Math.min(this.backupConfig.getJobTimeoutMs(), 180000),
        cwd: this.backupConfig.getProjectRoot(),
      });
    } catch (error) {
      if (ignoreMissing) {
        return;
      }
      throw error;
    }
  }

  private async runPostRestoreMigrations(password: string): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL || '';
    if (!databaseUrl) {
      throw new Error('DATABASE_URL nao definida para migrate pos-restore');
    }

    const env = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PGPASSWORD: password,
    };

    await this.processService.runCommand({
      command: this.backupConfig.getBinary('pnpm'),
      args: ['-C', this.backupConfig.getBackendDir(), 'exec', 'prisma', 'migrate', 'deploy'],
      env,
      timeoutMs: this.backupConfig.getJobTimeoutMs(),
      cwd: this.backupConfig.getProjectRoot(),
    });
  }

  private async buildFilteredRestoreList(params: {
    dumpPath: string;
    jobId: string;
    password: string;
    artifactSource: BackupArtifactSource;
    allowUnsafeObjects: boolean;
  }): Promise<string | undefined> {
    const { dumpPath, jobId, password, artifactSource, allowUnsafeObjects } = params;
    const protectedTables = this.backupConfig.getProtectedTablesForRestore();
    const strictUploadInspection =
      artifactSource === BackupArtifactSource.UPLOAD && this.backupConfig.isStrictUploadRestoreInspectionEnabled();

    if (protectedTables.length === 0 && !strictUploadInspection) {
      return undefined;
    }

    const result = await this.processService.runCommand({
      command: this.backupConfig.getBinary('pg_restore'),
      args: ['--list', dumpPath],
      env: this.buildCommandEnv(password),
      timeoutMs: Math.min(this.backupConfig.getJobTimeoutMs(), 300000),
      cwd: this.backupConfig.getProjectRoot(),
    });

    const lines = result.stdout.split(/\r?\n/);
    if (strictUploadInspection && !allowUnsafeObjects) {
      const blockedEntries = this.findBlockedEntriesFromRestoreList(
        lines,
        this.backupConfig.getUploadRestoreBlockedObjectTypes(),
      );

      if (blockedEntries.length > 0) {
        const sample = blockedEntries.slice(0, 5).join(' | ');
        throw new BadRequestException(
          `Dump de upload bloqueado por conter objetos potencialmente perigosos (${blockedEntries.length} ocorrencias).` +
            ` Exemplo: ${sample}. Use allowUnsafeObjects=true apenas apos revisao manual.`,
        );
      }
    }

    if (strictUploadInspection && allowUnsafeObjects) {
      await this.tryAppendJobLog(
        jobId,
        'WARN',
        'Restore de upload com allowUnsafeObjects=true (aprovacao manual assumida pelo operador)',
      );
    }

    if (protectedTables.length === 0) {
      return undefined;
    }

    const escapedPatterns = protectedTables.map((table) => table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const matcher = new RegExp(`\\b(${escapedPatterns.join('|')})\\b`, 'i');

    const filtered = lines
      .map((line) => {
        if (!line.trim()) {
          return line;
        }
        if (line.trim().startsWith(';')) {
          return line;
        }

        return matcher.test(line) ? `; ${line}` : line;
      })
      .join('\n');

    const listPath = this.resolveFilePath(`restore_list_${jobId}.txt`);
    fs.writeFileSync(listPath, filtered, { encoding: 'utf8', flag: 'w' });

    await this.tryAppendJobLog(
      jobId,
      'INFO',
      `Lista de restore gerada com protecao para tabelas: ${protectedTables.join(', ')}`,
    );

    return listPath;
  }

  private findBlockedEntriesFromRestoreList(lines: string[], blockedTypes: string[]): string[] {
    const normalizedTypes = blockedTypes
      .map((value) => value.trim().toUpperCase())
      .filter((value) => value.length > 0)
      .sort((a, b) => b.length - a.length);

    if (normalizedTypes.length === 0) {
      return [];
    }

    const matches: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';')) {
        continue;
      }

      const normalized = trimmed.replace(/\s+/g, ' ').toUpperCase();
      const descriptor = normalized.replace(/^\d+;\s+\d+\s+\d+\s+/, '');
      if (descriptor === normalized) {
        continue;
      }

      const blockedType = normalizedTypes.find((type) => descriptor === type || descriptor.startsWith(`${type} `));
      if (!blockedType) {
        continue;
      }

      matches.push(`${blockedType}: ${trimmed.slice(0, 180)}`);
    }

    return matches;
  }

  private validateUploadedBackup(file: Express.Multer.File): void {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowedExtensions = this.backupConfig.getAllowedExtensions();

    if (!allowedExtensions.includes(extension)) {
      throw new BadRequestException(`Extensao invalida. Use: ${allowedExtensions.join(', ')}`);
    }

    const maxSize = this.backupConfig.getMaxUploadBytes();
    if (file.size > maxSize) {
      throw new BadRequestException(`Arquivo excede limite maximo de ${maxSize} bytes`);
    }

    if (file.buffer.length < this.archiveMagic.length) {
      throw new BadRequestException('Arquivo dump invalido ou incompleto');
    }

    if (!file.buffer.subarray(0, this.archiveMagic.length).equals(this.archiveMagic)) {
      throw new BadRequestException('Assinatura do arquivo invalida. Esperado formato custom do pg_dump');
    }

    if (/[\\/]/.test(file.originalname || '')) {
      throw new BadRequestException('Nome de arquivo suspeito');
    }
  }

  private async validateDumpArchiveSignatureFromFile(filePath: string): Promise<void> {
    const handle = fs.openSync(filePath, 'r');
    try {
      const header = Buffer.alloc(this.archiveMagic.length);
      fs.readSync(handle, header, 0, this.archiveMagic.length, 0);
      if (!header.equals(this.archiveMagic)) {
        throw new Error('Arquivo nao possui assinatura PGDMP valida');
      }
    } finally {
      fs.closeSync(handle);
    }
  }

  private buildStoredFileName(prefix: string, extension: string): string {
    const safePrefix = prefix
      .normalize('NFKD')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[_\-.]+|[_\-.]+$/g, '')
      .toLowerCase()
      .slice(0, 80);

    const base = safePrefix || 'backup';
    const random = randomUUID().replace(/-/g, '').slice(0, 8);
    const fileName = `${base}_${random}${extension}`;
    return this.normalizeFileName(fileName);
  }

  private resolveFilePath(fileName: string): string {
    const normalized = this.normalizeFileName(fileName);
    const fullPath = path.resolve(path.join(this.backupConfig.getBackupDir(), normalized));
    this.assertSafeFilePath(fullPath);
    return fullPath;
  }

  private normalizeFileName(fileName: string): string {
    const normalized = path.basename((fileName || '').trim());
    if (!normalized || !/^[a-zA-Z0-9._-]+$/.test(normalized)) {
      throw new BadRequestException('Nome de arquivo invalido');
    }
    return normalized;
  }

  private assertSafeFilePath(filePath: string): void {
    const baseDir = path.resolve(this.backupConfig.getBackupDir());
    const fullPath = path.resolve(filePath);
    if (!fullPath.startsWith(`${baseDir}${path.sep}`) && fullPath !== baseDir) {
      throw new BadRequestException('Caminho de arquivo invalido');
    }
  }

  private calculateChecksumFromBuffer(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private async calculateChecksumFromFile(filePath: string): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  private buildCommandEnv(password: string): NodeJS.ProcessEnv {
    return {
      ...process.env,
      PGPASSWORD: password,
    };
  }

  private toJsonRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private parseLogs(value: unknown): JobLogEntry[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry) => typeof entry === 'object' && entry !== null)
      .map((entry) => {
        const item = entry as Partial<JobLogEntry>;
        return {
          at: typeof item.at === 'string' ? item.at : new Date().toISOString(),
          level:
            item.level === 'WARN' || item.level === 'ERROR' || item.level === 'INFO'
              ? item.level
              : 'INFO',
          message: typeof item.message === 'string' ? item.message : '',
        };
      })
      .filter((entry) => entry.message.length > 0);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      const commandResult = (error as any).result;
      if (commandResult?.stderr) {
        return String(commandResult.stderr).slice(-4000);
      }
      return error.message;
    }
    return String(error);
  }

  private wrapRestoreCutoverError(cutoverError: unknown, rollbackError: unknown, reconnectError: unknown): Error {
    const cutoverMessage = this.errorMessage(cutoverError);
    if (!rollbackError && !reconnectError) {
      return new Error(
        `Restore no banco principal falhou, mas rollback automatico foi aplicado. Erro original: ${cutoverMessage}`,
      );
    }

    if (!rollbackError && reconnectError) {
      const reconnectMessage = this.errorMessage(reconnectError);
      return new Error(
        `Restore no banco principal falhou, rollback automatico foi aplicado, ` +
          `mas a reconexao do backend com o banco falhou. Cutover: ${cutoverMessage}. Reconnect: ${reconnectMessage}`,
      );
    }

    const rollbackMessage = this.errorMessage(rollbackError);
    return new Error(
      `Restore no banco principal falhou e rollback automatico tambem falhou. ` +
        `Cutover: ${cutoverMessage}. Rollback: ${rollbackMessage}`,
    );
  }

  private async ensurePrismaConnectionHealthy(): Promise<void> {
    const attempts = this.backupConfig.getRestoreReconnectAttempts();
    const delayMs = this.backupConfig.getRestoreReconnectDelayMs();
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Tentativa ${attempt}/${attempts} de reconexao do Prisma apos restore falhou`);
      }

      try {
        await this.prisma.$disconnect();
      } catch {}
      try {
        await this.prisma.$connect();
      } catch (error) {
        lastError = error;
      }

      if (attempt < attempts) {
        await this.wait(delayMs);
      }
    }

    throw new Error(`Falha ao recuperar conexao Prisma apos restore: ${this.errorMessage(lastError)}`);
  }

  private async notifyFailure(jobId: string, message: string): Promise<void> {
    try {
      const job = await this.prisma.backupJob.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          type: true,
          artifactId: true,
          fileName: true,
          createdByUserId: true,
        },
      });

      await this.prisma.notification.create({
        data: {
          title: 'Falha em job de backup/restore',
          message: `Job ${jobId} finalizou com erro. Consulte logs de backup para detalhes.`,
          severity: 'critical',
          audience: 'super_admin',
          source: 'backup',
          userId: null,
          tenantId: null,
          read: false,
          data: {
            jobId,
            type: job?.type || null,
            artifactId: job?.artifactId || null,
            fileName: job?.fileName || null,
            error: message.slice(0, 1000),
          } as any,
        },
      });

      await this.auditService.log({
        action: 'BACKUP_JOB_FAILURE_ALERTED',
        userId: job?.createdByUserId || undefined,
        details: {
          jobId,
          type: job?.type || null,
        },
      });
    } catch (error) {
      this.logger.warn(`Falha ao emitir alerta de erro para job ${jobId}: ${String(error)}`);
    }
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async appendArtifactAudit(
    action: string,
    artifact: BackupArtifact,
    userId: string,
    context: RequestContext,
  ): Promise<void> {
    await this.auditService.log({
      action,
      userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: {
        artifactId: artifact.id,
        fileName: artifact.fileName,
        fileSize: Number(artifact.sizeBytes),
        checksumSha256: artifact.checksumSha256,
      },
    });
  }

  private async assertOperatorAllowed(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        tenantId: true,
        tenant: {
          select: {
            isMasterTenant: true,
          },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('Usuario nao encontrado para operacao de backup');
    }

    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Apenas SUPER_ADMIN pode operar backup/restore');
    }

    if (user.tenantId && user.tenant && !user.tenant.isMasterTenant) {
      throw new ForbiddenException('SUPER_ADMIN de tenant nao-master nao pode executar restore global');
    }
  }

  private async assertNoRunningUpdate(): Promise<void> {
    const update = await this.prisma.updateLog.findFirst({
      where: { status: 'STARTED' },
      select: { id: true },
    });

    if (update) {
      throw new ConflictException('Existe update em andamento; backup/restore bloqueado');
    }
  }

  private async getArtifactByIdOrThrow(artifactId: string): Promise<BackupArtifact> {
    const artifact = await this.prisma.backupArtifact.findUnique({ where: { id: artifactId } });
    if (!artifact || artifact.deletedAt) {
      throw new NotFoundException('Backup/artefato nao encontrado');
    }
    return artifact;
  }

  private assertArtifactUsableForRestore(artifact: BackupArtifact, restoreOptions: RestoreJobDto): void {
    this.assertSafeFilePath(artifact.filePath);

    const metadata = this.toJsonRecord(artifact.metadata);
    const artifactScope = typeof metadata?.environmentScope === 'string' ? metadata.environmentScope : null;
    const currentScope = this.backupConfig.getEnvironmentScope();

    if (artifactScope && artifactScope !== currentScope && !restoreOptions.forceCrossEnvironment) {
      throw new ConflictException(
        'Backup pertence a outro escopo de ambiente. Requer forceCrossEnvironment=true para continuar.',
      );
    }

    if (!artifactScope && artifact.source === BackupArtifactSource.UPLOAD && !restoreOptions.forceCrossEnvironment) {
      throw new ConflictException(
        'Upload sem escopo conhecido. Requer forceCrossEnvironment=true para confirmar restore.',
      );
    }
  }

  private deleteFileIfExists(filePath: string): void {
    try {
      this.assertSafeFilePath(filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.warn(`Falha ao remover arquivo ${filePath}: ${String(error)}`);
    }
  }
}
