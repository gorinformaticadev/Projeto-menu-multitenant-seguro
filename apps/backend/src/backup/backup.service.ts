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
import { NotificationService } from '../notifications/notification.service';
import { PathsService } from '../core/common/paths/paths.service';
import { CronService } from '../core/cron/cron.service';
import { PrismaReconnectFailed, PrismaService } from '../core/prisma/prisma.service';
import { BackupConfigService } from './backup-config.service';
import { BackupProcessService } from './backup-process.service';
import { BackupRuntimeStateService } from './backup-runtime-state.service';
import { RestoreJobDto } from './dto/restore-job.dto';

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
  source?: BackupOperationSource;
}

interface JobLogEntry {
  at: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

type BackupOperationSource = 'panel' | 'cron' | 'system' | 'wrapper';

class PromotionReconcileFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromotionReconcileFailed';
  }
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
    private readonly notificationService: NotificationService,
    private readonly cronService: CronService,
    private readonly backupConfig: BackupConfigService,
    private readonly processService: BackupProcessService,
    private readonly runtimeState: BackupRuntimeStateService,
    private readonly pathsService: PathsService,
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
    const source = this.resolveOperationSource(context, 'system');

    const job = await this.prisma.backupJob.create({
      data: {
        type: BackupJobType.BACKUP,
        status: BackupJobStatus.PENDING,
        progressPercent: 0,
        currentStep: 'QUEUED',
        createdByUserId: userId,
        metadata: {
          requestedBy: userId,
          source,
          backupType: 'database_full',
          retentionPolicy: this.backupConfig.getRetentionCount(),
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
    const source = this.resolveOperationSource(context, 'panel');

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
          source,
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

  async queueInternalRestoreByFileName(
    fileName: string,
    restoreOptions: RestoreJobDto,
    context: RequestContext,
  ): Promise<BackupJob> {
    const operatorId = await this.resolveInternalRestoreOperatorId();
    const artifact = await this.findArtifactByFileName(fileName);
    return this.queueRestoreFromArtifact(artifact.id, operatorId, restoreOptions, {
      ...context,
      source: 'wrapper',
    });
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
    const now = new Date();
    const pending = await this.prisma.backupJob.findFirst({
      where: {
        status: BackupJobStatus.PENDING,
        cancelRequested: false,
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
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
        nextRunAt: null,
      },
    });

    if (claim.count !== 1) {
      return null;
    }

    return this.prisma.backupJob.findUnique({ where: { id: pending.id } });
  }

  async returnJobToPending(jobId: string, reason: string): Promise<void> {
    const maxAttempts = this.backupConfig.getLockMaxAttempts();
    const updatedAttempt = await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        lockAttempts: {
          increment: 1,
        },
      },
      select: {
        lockAttempts: true,
      },
    });

    const attempt = updatedAttempt.lockAttempts;
    if (attempt >= maxAttempts) {
      const message = `Nao foi possivel adquirir lock global apos ${attempt} tentativas. Tente novamente.`;
      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: {
          status: BackupJobStatus.FAILED,
          finishedAt: new Date(),
          currentStep: 'FAILED',
          error: message,
          nextRunAt: null,
        },
      });

      await this.appendJobLog(jobId, 'ERROR', message);
      await this.notifyFailure(jobId, message);
      return;
    }

    const delayMs = this.calculateLockBackoffDelayMs(attempt);
    const nextRunAt = new Date(Date.now() + delayMs);

    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupJobStatus.PENDING,
        currentStep: 'WAITING_LOCK',
        nextRunAt,
      },
    });

    await this.appendJobLog(
      jobId,
      'INFO',
      `${reason}. Tentativa de lock ${attempt}/${maxAttempts}. Reagendado em ${delayMs}ms.`,
    );
  }

  async markJobSuccess(jobId: string, details: Partial<BackupJob> = {}): Promise<void> {
    await this.withPrismaConnectionRetry('markJobSuccess', async () => {
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
    });
  }

  async markJobFailed(jobId: string, error: unknown): Promise<void> {
    const message = this.errorMessage(error);
    await this.withPrismaConnectionRetry('markJobFailed', async () => {
      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: {
          status: BackupJobStatus.FAILED,
          finishedAt: new Date(),
          currentStep: 'FAILED',
          error: message,
        },
      });
    });

    await this.appendJobLog(jobId, 'ERROR', message);
    await this.notifyFailure(jobId, message);
  }

  async markJobCanceled(jobId: string, reason: string): Promise<void> {
    await this.withPrismaConnectionRetry('markJobCanceled', async () => {
      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: {
          status: BackupJobStatus.CANCELED,
          finishedAt: new Date(),
          currentStep: 'CANCELED',
          error: reason,
        },
      });
    });

    await this.appendJobLog(jobId, 'WARN', reason);
  }

  async heartbeat(jobId: string): Promise<void> {
    await this.withPrismaConnectionRetry('heartbeat', async () => {
      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: { updatedAt: new Date() },
      });
    });
  }

  async updateJobProgress(
    jobId: string,
    step: string,
    progressPercent: number,
    message?: string,
    level: JobLogEntry['level'] = 'INFO',
  ): Promise<void> {
    await this.withPrismaConnectionRetry('updateJobProgress', async () => {
      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: {
          currentStep: step,
          progressPercent: Math.max(0, Math.min(100, Math.round(progressPercent))),
        },
      });
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
    const job = await this.withPrismaConnectionRetry('appendJobLog.find', async () => {
      return await this.prisma.backupJob.findUnique({
        where: { id: jobId },
        select: { logs: true },
      });
    });

    const currentLogs = this.parseLogs(job?.logs);
    currentLogs.push({
      at: new Date().toISOString(),
      level,
      message: message.slice(0, 4000),
    });

    const trimmed = currentLogs.slice(-400);

    await this.withPrismaConnectionRetry('appendJobLog.update', async () => {
      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: {
          logs: trimmed as any,
        },
      });
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

    const actor = await this.resolveAuditActor(job.createdByUserId);
    const startedAt = job.startedAt || new Date();
    const jobMetadata = this.toJsonRecord(job.metadata);
    const source = this.resolveOperationSourceFromMetadata(jobMetadata, 'system');
    const backupType = this.readStringMetadata(jobMetadata, 'backupType') || 'database_full';
    const retentionPolicy = this.readNumberMetadata(jobMetadata, 'retentionPolicy');

    await this.auditService.log({
      action: 'BACKUP_STARTED',
      severity: 'info',
      message: `Backup iniciado (job ${job.id})`,
      actor,
      metadata: {
        source,
        jobId: job.id,
        backupType,
        retentionPolicy,
      },
    });

    const db = this.backupConfig.getDatabaseConfig({ useActiveDatabase: true });
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
    await this.updateJobProgress(job.id, 'BACKUP_ASSETS', 90, 'Gerando snapshot de uploads e .env');
    const assets = await this.createBackupAssets(fileName);

    const artifact = await this.prisma.backupArtifact.create({
      data: {
        fileName,
        filePath,
        sizeBytes: BigInt(size),
        checksumSha256: checksum,
        source: BackupArtifactSource.BACKUP,
        createdByUserId: job.createdByUserId,
        metadata: {
          version: process.env.APP_VERSION || 'unknown',
          dbDumpPath: filePath,
          uploadsArchivePath: assets.uploadsArchivePath,
          envSnapshotPath: assets.envSnapshotPath,
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
      action: 'BACKUP_COMPLETED',
      severity: 'info',
      message: `Backup concluido com sucesso (job ${job.id})`,
      actor,
      metadata: {
        source,
        jobId: job.id,
        backupType,
        retentionPolicy,
        artifactId: artifact.id,
        durationSeconds: this.calculateDurationSeconds(startedAt),
        dbDumpCaptured: true,
        uploadsArchiveCaptured: Boolean(assets.uploadsArchivePath),
        envSnapshotCaptured: Boolean(assets.envSnapshotPath),
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
    const activeDatabase = this.backupConfig.getActiveDatabaseName();
    const stagingDatabase = this.backupConfig.buildStagingDatabaseName(job.id);
    const rollbackDatabase = this.backupConfig.buildRollbackDatabaseName(activeDatabase, job.id);
    const metadata = this.toJsonRecord(job.metadata);
    const actor = await this.resolveAuditActor(job.createdByUserId);
    const startedAt = job.startedAt || new Date();
    const source = this.resolveOperationSourceFromMetadata(metadata, 'panel');

    const restoreStartMetadata = {
      source,
      restoreId: job.id,
      backupId: artifact.id,
      artifactIds: [artifact.id],
      artifactSource: artifact.source,
    };

    await this.auditService.log({
      action: 'RESTORE_STARTED',
      severity: 'critical',
      message: `Restore iniciado (job ${job.id})`,
      actor,
      metadata: restoreStartMetadata,
    });

    await this.notificationService.emitSystemAlert({
      action: 'RESTORE_STARTED',
      severity: 'critical',
      title: 'Restauracao iniciada',
      body: 'Uma restauracao do sistema foi iniciada.',
      data: restoreStartMetadata,
      module: 'backup',
    });

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
    let safetyArtifact: BackupArtifact | null = null;
    let maintenanceEnabled = false;
    let keepMaintenanceEnabled = false;
    let promoted = false;
    let rollbackPromotionApplied = false;

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
      safetyArtifact = await this.createSafetyBackup(job, db.password);
      rollbackRestoreListPath = await this.buildFilteredRestoreList({
        dumpPath: safetyArtifact.filePath,
        jobId: `${job.id}_rollback`,
        password: db.password,
        artifactSource: safetyArtifact.source,
        allowUnsafeObjects: true,
      });

      await this.updateJobProgress(job.id, 'RESTORE_ENTER_MAINTENANCE', 80, 'Ativando modo manutencao e pausando schedulers');
      this.runtimeState.enableMaintenance(job.id, 'restore-cutover');
      maintenanceEnabled = true;
      this.cronService.pauseAllForMaintenance();
      await this.updateJobProgress(
        job.id,
        'RESTORE_QUIESCE',
        84,
        'Drenando conexoes Prisma e bloqueando reconexao durante cutover',
      );
      await this.updateJobProgress(
        job.id,
        'RECONCILE_PROMOTION_STATE',
        88,
        'Reconciliando estado de promocao para recuperacao pos-crash',
      );
      await this.prisma.quiesceForCutover();

      const cutoverTimeoutMs = Math.min(
        this.backupConfig.getJobTimeoutMs(),
        this.backupConfig.getRestoreMaintenanceWindowSeconds() * 1000,
      );
      try {
        await this.promoteStagingDatabase({
          activeDatabase,
          stagingDatabase,
          rollbackDatabase,
          password: db.password,
          timeoutMs: cutoverTimeoutMs,
        });
      } catch (promoteError) {
        if (promoteError instanceof PromotionReconcileFailed) {
          keepMaintenanceEnabled = true;
          this.runtimeState.enableMaintenance(job.id, 'restore-reconcile-failed');
          await this.tryAppendJobLog(
            job.id,
            'ERROR',
            'Estado invalido de promocao detectado. Mantendo manutencao.',
          );
        }
        throw promoteError;
      }
      promoted = true;
      this.backupConfig.setActiveDatabaseName(activeDatabase);
      await this.restoreProtectedTablesFromRollback({
        rollbackDatabase,
        targetDatabase: activeDatabase,
        password: db.password,
        jobId: job.id,
        timeoutMs: cutoverTimeoutMs,
      });

      try {
        await this.prisma.resumeAfterCutover();
      } catch (resumeError) {
        if (resumeError instanceof PrismaReconnectFailed) {
          keepMaintenanceEnabled = true;
          this.runtimeState.enableMaintenance(job.id, 'restore-reconnect-failed');
          await this.tryAppendJobLog(
            job.id,
            'ERROR',
            'Falha ao reconectar DB apos promocao. Mantendo manutencao.',
          );
          throw new Error('Falha ao reconectar DB apos promocao. Mantendo manutencao.');
        }

        throw resumeError;
      }
      await this.ensurePrismaConnectionHealthy();
      await this.updateJobProgress(job.id, 'RESTORE_SMOKE_TEST', 93, 'Executando smoke test pos-promocao');
      await this.validatePromotedDatabase();

      if (metadata?.runMigrations === true) {
        await this.updateJobProgress(job.id, 'RESTORE_MIGRATIONS', 95, 'Executando migrate deploy');
        await this.runPostRestoreMigrations(db.password);
        await this.ensurePrismaConnectionHealthy();
      }

      await this.updateJobProgress(
        job.id,
        'RESTORE_UPLOADS',
        96,
        'Restaurando uploads para o diretorio canonico',
      );
      const restoredUploadsPath = await this.restoreUploadsFromArtifactMetadata(artifact, job.id);

      await this.updateJobProgress(job.id, 'RESTORE_CLEANUP', 98, 'Finalizando restore e registrando auditoria');

      await this.markJobSuccess(job.id, {
        fileName: artifact.fileName,
        filePath: artifact.filePath,
        sizeBytes: artifact.sizeBytes,
        checksumSha256: artifact.checksumSha256,
        metadata: {
          ...(this.toJsonRecord(job.metadata) || {}),
          safetyBackupArtifactId: safetyArtifact?.id || null,
          stagingDatabase,
          activeDatabase,
          rollbackDatabase,
          restoredUploadsPath,
          promotedAt: new Date().toISOString(),
        } as any,
      });

      const restoreCompletedMetadata = {
        source,
        restoreId: job.id,
        backupId: artifact.id,
        artifactIds: {
          backupArtifactId: artifact.id,
          safetyBackupArtifactId: safetyArtifact?.id || null,
        },
        durationSeconds: this.calculateDurationSeconds(startedAt),
      };

      await this.auditService.log({
        action: 'RESTORE_COMPLETED',
        severity: 'critical',
        message: `Restore concluido com sucesso (job ${job.id})`,
        actor,
        metadata: restoreCompletedMetadata,
      });

      await this.notificationService.emitSystemAlert({
        action: 'RESTORE_COMPLETED',
        severity: 'critical',
        title: 'Restauracao concluida',
        body: 'A restauracao do sistema foi concluida com sucesso.',
        data: restoreCompletedMetadata,
        module: 'backup',
      });
    } catch (error) {
      let rollbackError: unknown = null;

      if (promoted && !keepMaintenanceEnabled) {
        try {
          await this.rollbackPromotion({
            activeDatabase,
            rollbackDatabase,
            password: db.password,
            timeoutMs: Math.min(
              this.backupConfig.getJobTimeoutMs(),
              this.backupConfig.getRestoreMaintenanceWindowSeconds() * 1000,
            ),
          });
          rollbackPromotionApplied = true;
        } catch (promoteRollbackError) {
          rollbackError = promoteRollbackError;
        }
      }

      if (rollbackError) {
        throw new Error(
          `Falha no restore apos promocao e rollback de promocao tambem falhou. ` +
            `Erro restore: ${this.errorMessage(error)}. Erro rollback: ${this.errorMessage(rollbackError)}`,
        );
      }

      if (promoted && rollbackPromotionApplied) {
        throw new Error(
          `Restore falhou apos promocao, mas rollback da promocao foi aplicado com sucesso. ` +
            `Erro original: ${this.errorMessage(error)}`,
        );
      }

      throw error;
    } finally {
      if (this.prisma.isCutoverBlocked()) {
        try {
          await this.prisma.resumeAfterCutover();
        } catch (resumeError) {
          if (maintenanceEnabled) {
            keepMaintenanceEnabled = true;
            this.runtimeState.enableMaintenance(job.id, 'restore-reconnect-failed');
            await this.tryAppendJobLog(
              job.id,
              'ERROR',
              'Falha ao reconectar DB apos cutover. Mantendo manutencao.',
            );
          }
          this.logger.error(
            `Falha ao recuperar conexao Prisma apos cutover do job ${job.id}: ${this.errorMessage(resumeError)}`,
          );
        }
      }

      if (this.cronService.isMaintenancePaused() && !keepMaintenanceEnabled) {
        this.cronService.resumeAllAfterMaintenance();
      }

      if (maintenanceEnabled && !keepMaintenanceEnabled) {
        this.runtimeState.disableMaintenance(job.id);
      }
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
    const db = this.backupConfig.getDatabaseConfig({ useActiveDatabase: true });
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

  private async createBackupAssets(
    dbDumpFileName: string,
  ): Promise<{ uploadsArchivePath: string | null; envSnapshotPath: string | null }> {
    const baseName = dbDumpFileName.replace(/\.[^.]+$/, '');
    const uploadsArchivePath = await this.createUploadsSnapshot(baseName);
    const envSnapshotPath = this.createEnvSnapshot(baseName);

    return {
      uploadsArchivePath,
      envSnapshotPath,
    };
  }

  private async createUploadsSnapshot(baseName: string): Promise<string | null> {
    const uploadsSource = this.pathsService.getUploadsDir();
    if (!fs.existsSync(uploadsSource)) {
      return null;
    }

    const hasAnyFile = fs.readdirSync(uploadsSource).length > 0;
    if (!hasAnyFile) {
      return null;
    }

    const archivePath = this.resolveFilePath(`${baseName}_uploads.tar.gz`);

    try {
      await this.processService.runCommand({
        command: 'tar',
        args: ['-czf', archivePath, '-C', uploadsSource, '.'],
        env: { ...process.env },
        timeoutMs: this.backupConfig.getJobTimeoutMs(),
        cwd: this.backupConfig.getProjectRoot(),
      });
      return archivePath;
    } catch (error) {
      this.logger.warn(
        `Falha ao gerar tar de uploads. Usando snapshot em pasta. Detalhe: ${this.errorMessage(error)}`,
      );

      const snapshotDir = this.resolveFilePath(`${baseName}_uploads_snapshot`);
      if (!fs.existsSync(snapshotDir)) {
        fs.mkdirSync(snapshotDir, { recursive: true });
      }
      this.copyDirectoryContents(uploadsSource, snapshotDir);
      return snapshotDir;
    }
  }

  private createEnvSnapshot(baseName: string): string | null {
    const envPath = this.resolveEnvironmentFilePath();
    if (!envPath) {
      return null;
    }

    const snapshotPath = this.resolveFilePath(`${baseName}_env.snapshot`);
    fs.copyFileSync(envPath, snapshotPath);
    return snapshotPath;
  }

  private resolveEnvironmentFilePath(): string | null {
    const explicitEnv = (process.env.BACKUP_ENV_FILE || '').trim();
    const candidates = [
      explicitEnv,
      path.join(this.backupConfig.getProjectRoot(), 'install', '.env.production'),
      path.join(this.backupConfig.getProjectRoot(), '.env.production'),
      path.join(this.backupConfig.getProjectRoot(), '.env'),
      path.join(this.backupConfig.getBackendDir(), '.env'),
    ].filter((candidate) => !!candidate) as string[];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private async restoreUploadsFromArtifactMetadata(
    artifact: BackupArtifact,
    jobId: string,
  ): Promise<string | null> {
    const metadata = this.toJsonRecord(artifact.metadata);
    const uploadsArchivePath =
      typeof metadata?.uploadsArchivePath === 'string' ? metadata.uploadsArchivePath : null;
    if (!uploadsArchivePath) {
      return null;
    }

    this.assertSafeFilePath(uploadsArchivePath);
    if (!fs.existsSync(uploadsArchivePath)) {
      throw new Error(
        `Arquivo de uploads informado no backup nao encontrado: ${uploadsArchivePath}`,
      );
    }

    const uploadsDir = this.pathsService.ensureDir(this.pathsService.getUploadsDir());
    fs.accessSync(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);

    if (fs.statSync(uploadsArchivePath).isDirectory()) {
      this.copyDirectoryContents(uploadsArchivePath, uploadsDir);
    } else if (/\.tar\.gz$|\.tgz$/i.test(uploadsArchivePath)) {
      await this.processService.runCommand({
        command: 'tar',
        args: ['-xzf', uploadsArchivePath, '-C', uploadsDir],
        env: { ...process.env },
        timeoutMs: this.backupConfig.getJobTimeoutMs(),
        cwd: this.backupConfig.getProjectRoot(),
      });
    } else {
      throw new Error(`Formato de snapshot de uploads nao suportado: ${uploadsArchivePath}`);
    }

    await this.appendJobLog(jobId, 'INFO', `Uploads restaurados em ${uploadsDir}`);
    return uploadsDir;
  }

  private copyDirectoryContents(sourceDir: string, targetDir: string): void {
    if (!fs.existsSync(sourceDir)) {
      return;
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const entry of fs.readdirSync(sourceDir)) {
      const sourcePath = path.join(sourceDir, entry);
      const targetPath = path.join(targetDir, entry);
      fs.cpSync(sourcePath, targetPath, {
        recursive: true,
        force: true,
      });
    }
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

  private async restoreProtectedTablesFromRollback(params: {
    rollbackDatabase: string;
    targetDatabase: string;
    password: string;
    jobId: string;
    timeoutMs: number;
  }): Promise<void> {
    const configuredTables = this.backupConfig
      .getProtectedTablesForRestore()
      .map((table) => table.trim().toLowerCase())
      .filter((table) => table.length > 0)
      .map((table) => this.assertTableIdentifier(table));
    const protectedTables = Array.from(new Set(configuredTables));

    if (protectedTables.length === 0) {
      return;
    }

    const expectedListSql = protectedTables.map((table) => `'${this.escapeSqlLiteral(table)}'`).join(', ');
    const existingRaw = await this.runPsqlScalarQuery({
      database: params.rollbackDatabase,
      password: params.password,
      sql:
        `SELECT array_to_string(array_agg(lower(table_name) ORDER BY lower(table_name)), ',') ` +
        `FROM information_schema.tables ` +
        `WHERE table_schema='public' AND lower(table_name) = ANY(ARRAY[${expectedListSql}]);`,
      timeoutMs: Math.min(params.timeoutMs, 120000),
    });
    const existingProtectedTables = String(existingRaw || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .map((table) => this.assertTableIdentifier(table));

    if (existingProtectedTables.length === 0) {
      await this.tryAppendJobLog(
        params.jobId,
        'WARN',
        `Nenhuma tabela protegida encontrada em ${params.rollbackDatabase}; seguindo sem merge de controle.`,
      );
      return;
    }

    if (!existingProtectedTables.includes('backup_jobs')) {
      throw new Error(
        `Tabela de controle "backup_jobs" ausente em ${params.rollbackDatabase}. ` +
          `Nao e seguro concluir o cutover sem metadados de jobs de backup/restore.`,
      );
    }

    const snapshotPath = this.resolveFilePath(`restore_protected_${params.jobId}_${Date.now()}.dump`);
    const db = this.backupConfig.getDatabaseConfig();

    const dumpArgs = [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--host',
      db.host,
      '--port',
      String(db.port),
      '--username',
      db.user,
      '--dbname',
      params.rollbackDatabase,
      '--file',
      snapshotPath,
    ];
    for (const table of existingProtectedTables) {
      dumpArgs.push('--table', `public.${table}`);
    }

    try {
      await this.processService.runCommand({
        command: this.backupConfig.getBinary('pg_dump'),
        args: dumpArgs,
        env: this.buildCommandEnv(params.password),
        timeoutMs: params.timeoutMs,
        cwd: this.backupConfig.getProjectRoot(),
      });

      await this.executePgRestore({
        dbName: params.targetDatabase,
        dumpPath: snapshotPath,
        password: params.password,
        timeoutMs: params.timeoutMs,
      });

      await this.tryAppendJobLog(
        params.jobId,
        'INFO',
        `Tabelas protegidas reaplicadas apos cutover: ${existingProtectedTables.join(', ')}`,
      );
    } finally {
      this.deleteFileIfExists(snapshotPath);
    }
  }

  private async validateStagingDatabase(database: string, password: string): Promise<void> {
    await this.runPsqlScalarQuery({
      database,
      password,
      sql: 'SELECT 1',
      timeoutMs: Math.min(this.backupConfig.getJobTimeoutMs(), 120000),
    });

    const tableCountRaw = await this.runPsqlScalarQuery({
      database,
      password,
      sql: "SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public';",
      timeoutMs: Math.min(this.backupConfig.getJobTimeoutMs(), 120000),
    });
    const parsedCount = Number(tableCountRaw);
    if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
      throw new Error('Banco staging restaurado sem tabelas no schema public');
    }

    const requiredTables = this.backupConfig.getRequiredTablesForRestoreValidation();
    if (requiredTables.length === 0) {
      return;
    }

    const normalizedRequired = requiredTables.map((table) => table.trim().toLowerCase()).filter(Boolean);
    if (normalizedRequired.length === 0) {
      return;
    }

    const expectedListSql = normalizedRequired.map((table) => `'${this.escapeSqlLiteral(table)}'`).join(', ');
    const existingRaw = await this.runPsqlScalarQuery({
      database,
      password,
      sql:
        `SELECT array_to_string(array_agg(lower(table_name) ORDER BY lower(table_name)), ',') ` +
        `FROM information_schema.tables ` +
        `WHERE table_schema='public' AND lower(table_name) = ANY(ARRAY[${expectedListSql}]);`,
      timeoutMs: Math.min(this.backupConfig.getJobTimeoutMs(), 120000),
    });

    const existingSet = new Set(
      String(existingRaw || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    );
    const missing = normalizedRequired.filter((table) => !existingSet.has(table));
    if (missing.length > 0) {
      throw new Error(`Banco staging nao contem tabelas obrigatorias: ${missing.join(', ')}`);
    }
  }

  private async recreateDatabase(database: string, password: string): Promise<void> {
    await this.dropDatabase(database, password, true);

    const db = this.backupConfig.getDatabaseConfig();
    const commandDb = this.backupConfig.getDatabaseConfig({ useAdmin: true });
    const commandPassword = this.backupConfig.isDatabaseAdminConfigured() ? commandDb.password : password;
    const args = [
      '--host',
      commandDb.host,
      '--port',
      String(commandDb.port),
      '--username',
      commandDb.user,
    ];
    if (this.backupConfig.isDatabaseAdminConfigured() && commandDb.user !== db.user) {
      args.push('--owner', db.user);
    }
    args.push(database);

    try {
      await this.processService.runCommand({
        command: this.backupConfig.getBinary('createdb'),
        args,
        env: this.buildCommandEnv(commandPassword),
        timeoutMs: Math.min(this.backupConfig.getJobTimeoutMs(), 180000),
        cwd: this.backupConfig.getProjectRoot(),
      });
    } catch (error) {
      const message = this.errorMessage(error);
      if (/permission denied to create database/i.test(message)) {
        if (this.backupConfig.isDatabaseAdminConfigured()) {
          throw new Error(
            `Usuario administrativo de BACKUP_ADMIN_DATABASE_URL sem permissao CREATEDB. ` +
              `Conceda no PostgreSQL: ALTER ROLE "${commandDb.user}" CREATEDB;`,
          );
        }
        throw new Error(
          `Usuario do DATABASE_URL sem permissao CREATEDB. ` +
            `Conceda no PostgreSQL: ALTER ROLE "${db.user}" CREATEDB; ` +
            `ou configure BACKUP_ADMIN_DATABASE_URL com usuario administrativo.`,
        );
      }
      throw error;
    }
  }

  private async dropDatabase(database: string, password: string, ignoreMissing = false): Promise<void> {
    const db = this.backupConfig.getDatabaseConfig({ useAdmin: true });
    const commandPassword = this.backupConfig.isDatabaseAdminConfigured() ? db.password : password;
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
        env: this.buildCommandEnv(commandPassword),
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

  private async promoteStagingDatabase(params: {
    activeDatabase: string;
    stagingDatabase: string;
    rollbackDatabase: string;
    password: string;
    timeoutMs: number;
  }): Promise<void> {
    const activeDatabase = this.assertDatabaseIdentifier(params.activeDatabase, 'activeDatabase');
    const stagingDatabase = this.assertDatabaseIdentifier(params.stagingDatabase, 'stagingDatabase');
    const rollbackDatabase = this.assertDatabaseIdentifier(params.rollbackDatabase, 'rollbackDatabase');
    const reconcileCase = await this.reconcilePromotionState(
      activeDatabase,
      stagingDatabase,
      rollbackDatabase,
      params.password,
      params.timeoutMs,
    );

    if (reconcileCase === 'C' || reconcileCase === 'D') {
      return;
    }

    if (reconcileCase === 'A') {
      throw new PromotionReconcileFailed('Banco staging nao encontrado para promocao apos reconciler');
    }

    await this.terminateDatabaseConnections(
      [activeDatabase, stagingDatabase, rollbackDatabase],
      params.password,
      params.timeoutMs,
    );
    await this.runPsqlCommand({
      database: 'postgres',
      password: params.password,
      sql: `DROP DATABASE IF EXISTS ${this.quoteDatabaseIdentifier(rollbackDatabase)};`,
      timeoutMs: params.timeoutMs,
    });
    await this.runPsqlCommand({
      database: 'postgres',
      password: params.password,
      sql:
        `ALTER DATABASE ${this.quoteDatabaseIdentifier(activeDatabase)} ` +
        `RENAME TO ${this.quoteDatabaseIdentifier(rollbackDatabase)};`,
      timeoutMs: params.timeoutMs,
    });

    try {
      await this.runPsqlCommand({
        database: 'postgres',
        password: params.password,
        sql:
          `ALTER DATABASE ${this.quoteDatabaseIdentifier(stagingDatabase)} ` +
          `RENAME TO ${this.quoteDatabaseIdentifier(activeDatabase)};`,
        timeoutMs: params.timeoutMs,
      });
    } catch (error) {
      try {
        await this.runPsqlCommand({
          database: 'postgres',
          password: params.password,
          sql:
            `ALTER DATABASE ${this.quoteDatabaseIdentifier(rollbackDatabase)} ` +
            `RENAME TO ${this.quoteDatabaseIdentifier(activeDatabase)};`,
          timeoutMs: params.timeoutMs,
        });
      } catch (rollbackRenameError) {
        throw new Error(
          `Falha ao promover staging e falha ao reverter rename inicial. ` +
            `Promocao: ${this.errorMessage(error)}. Reversao: ${this.errorMessage(rollbackRenameError)}`,
        );
      }

      throw error;
    }
  }

  private async reconcilePromotionState(
    activeDatabase: string,
    stagingDatabase: string,
    rollbackDatabase: string,
    password: string,
    timeoutMs: number,
  ): Promise<'A' | 'B' | 'C' | 'D'> {
    const active = this.assertDatabaseIdentifier(activeDatabase, 'activeDatabase');
    const staging = this.assertDatabaseIdentifier(stagingDatabase, 'stagingDatabase');
    const rollback = this.assertDatabaseIdentifier(rollbackDatabase, 'rollbackDatabase');
    const inList = [active, staging, rollback].map((name) => `'${this.escapeSqlLiteral(name)}'`).join(', ');

    const catalogOutput = await this.runPsqlCommand({
      database: 'postgres',
      password,
      sql: `COPY (SELECT datname FROM pg_database WHERE datname IN (${inList}) ORDER BY datname) TO STDOUT;`,
      timeoutMs,
    });

    const present = this.parseExistingDatabasesFromCatalogOutput(catalogOutput, [active, staging, rollback]);
    const hasActive = present.has(active);
    const hasStaging = present.has(staging);
    const hasRollback = present.has(rollback);

    // A) Normal: active exists and staging does not exist.
    if (hasActive && !hasStaging && !hasRollback) {
      this.logger.log(`Reconcile de promocao: caso A (active=${active})`);
      return 'A';
    }

    // B) Pre-promote: active + staging exist.
    if (hasActive && hasStaging && !hasRollback) {
      this.logger.log(`Reconcile de promocao: caso B (active + staging presentes)`);
      return 'B';
    }

    // C) Crash between renames: active missing, rollback + staging exist.
    if (!hasActive && hasStaging && hasRollback) {
      this.logger.warn(`Reconcile de promocao: caso C detectado; aplicando rename staging -> active`);
      await this.terminateDatabaseConnections([active, staging, rollback], password, timeoutMs);
      await this.runPsqlCommand({
        database: 'postgres',
        password,
        sql:
          `ALTER DATABASE ${this.quoteDatabaseIdentifier(staging)} ` +
          `RENAME TO ${this.quoteDatabaseIdentifier(active)};`,
        timeoutMs,
      });
      return 'C';
    }

    // D) Promotion already applied: active + rollback exist, staging missing.
    if (hasActive && !hasStaging && hasRollback) {
      this.logger.log(`Reconcile de promocao: caso D (promocao ja aplicada)`);
      return 'D';
    }

    // E) Invalid states must fail closed.
    this.logger.error(
      `Reconcile de promocao: caso E invalido (active=${hasActive}, staging=${hasStaging}, rollback=${hasRollback})`,
    );
    throw new PromotionReconcileFailed('Estado invalido de promocao detectado no reconciler. Mantendo manutencao.');
  }

  private parseExistingDatabasesFromCatalogOutput(output: string, expectedDatabases: string[]): Set<string> {
    const expected = new Set(expectedDatabases);
    const present = new Set<string>();
    const lines = String(output || '').split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      if (
        /^COPY\s+\d+$/i.test(trimmed) ||
        /^datname$/i.test(trimmed) ||
        /^-+$/.test(trimmed) ||
        /^\(\d+\s+rows?\)$/i.test(trimmed)
      ) {
        continue;
      }

      if (expected.has(trimmed)) {
        present.add(trimmed);
        continue;
      }

      const tokens = trimmed.split(/[\s|]+/).filter((token) => token.length > 0);
      for (const token of tokens) {
        if (expected.has(token)) {
          present.add(token);
        }
      }
    }

    return present;
  }

  private async rollbackPromotion(params: {
    activeDatabase: string;
    rollbackDatabase: string;
    password: string;
    timeoutMs: number;
  }): Promise<void> {
    const activeDatabase = this.assertDatabaseIdentifier(params.activeDatabase, 'activeDatabase');
    const rollbackDatabase = this.assertDatabaseIdentifier(params.rollbackDatabase, 'rollbackDatabase');

    if (!this.prisma.isCutoverBlocked()) {
      await this.prisma.quiesceForCutover();
    }

    const failedPromotedDatabase = this.backupConfig.buildRollbackDatabaseName(activeDatabase, randomUUID());

    await this.terminateDatabaseConnections([activeDatabase, rollbackDatabase], params.password, params.timeoutMs);

    await this.runPsqlCommand({
      database: 'postgres',
      password: params.password,
      sql:
        `ALTER DATABASE ${this.quoteDatabaseIdentifier(activeDatabase)} ` +
        `RENAME TO ${this.quoteDatabaseIdentifier(failedPromotedDatabase)};`,
      timeoutMs: params.timeoutMs,
    });
    await this.runPsqlCommand({
      database: 'postgres',
      password: params.password,
      sql:
        `ALTER DATABASE ${this.quoteDatabaseIdentifier(rollbackDatabase)} ` +
        `RENAME TO ${this.quoteDatabaseIdentifier(activeDatabase)};`,
      timeoutMs: params.timeoutMs,
    });

    this.backupConfig.setActiveDatabaseName(activeDatabase);
    await this.prisma.resumeAfterCutover();
  }

  private async validatePromotedDatabase(): Promise<void> {
    const db = this.backupConfig.getDatabaseConfig({ useActiveDatabase: true });
    const requiredTables = this.backupConfig.getRequiredTablesForRestoreValidation();
    await this.validateStagingDatabase(db.database, db.password);

    if (requiredTables.includes('_prisma_migrations')) {
      try {
        await this.prisma.$queryRawUnsafe('SELECT 1 FROM "_prisma_migrations" LIMIT 1');
      } catch (error) {
        throw new Error(`Smoke test de migrations falhou no banco promovido: ${this.errorMessage(error)}`);
      }
    }
  }

  private async runPsqlCommand(params: {
    database: string;
    password: string;
    sql: string;
    timeoutMs: number;
  }): Promise<string> {
    const db = this.backupConfig.getDatabaseConfig();
    const result = await this.processService.runCommand({
      command: this.backupConfig.getBinary('psql'),
      args: [
        '--host',
        db.host,
        '--port',
        String(db.port),
        '--username',
        db.user,
        '--dbname',
        this.assertDatabaseIdentifier(params.database, 'database'),
        '--set',
        'ON_ERROR_STOP=on',
        '--command',
        params.sql,
      ],
      env: this.buildCommandEnv(params.password),
      timeoutMs: params.timeoutMs,
      cwd: this.backupConfig.getProjectRoot(),
    });

    return (result.stdout || '').trim();
  }

  private async runPsqlScalarQuery(params: {
    database: string;
    password: string;
    sql: string;
    timeoutMs: number;
  }): Promise<string> {
    const db = this.backupConfig.getDatabaseConfig();
    const result = await this.processService.runCommand({
      command: this.backupConfig.getBinary('psql'),
      args: [
        '--host',
        db.host,
        '--port',
        String(db.port),
        '--username',
        db.user,
        '--dbname',
        this.assertDatabaseIdentifier(params.database, 'database'),
        '--set',
        'ON_ERROR_STOP=on',
        '--tuples-only',
        '--no-align',
        '--command',
        params.sql,
      ],
      env: this.buildCommandEnv(params.password),
      timeoutMs: params.timeoutMs,
      cwd: this.backupConfig.getProjectRoot(),
    });

    return (result.stdout || '').trim();
  }

  private async terminateDatabaseConnections(databases: string[], password: string, timeoutMs: number): Promise<void> {
    const validNames = Array.from(
      new Set(
        databases
          .map((dbName) => this.assertDatabaseIdentifier(dbName, 'database'))
          .filter((dbName) => dbName !== 'postgres'),
      ),
    );

    if (validNames.length === 0) {
      return;
    }

    const inList = validNames.map((name) => `'${this.escapeSqlLiteral(name)}'`).join(', ');
    await this.runPsqlCommand({
      database: 'postgres',
      password,
      sql:
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity ` +
        `WHERE datname IN (${inList}) AND pid <> pg_backend_pid();`,
      timeoutMs,
    });
  }

  private async runPostRestoreMigrations(password: string): Promise<void> {
    const databaseUrl = this.backupConfig.buildDatabaseUrl(this.backupConfig.getActiveDatabaseName());
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
    const dangerousObjectInspection = this.backupConfig.isDangerousObjectInspectionEnabled() || strictUploadInspection;

    if (protectedTables.length === 0 && !dangerousObjectInspection) {
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
    if (dangerousObjectInspection && !allowUnsafeObjects) {
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

    if (dangerousObjectInspection && allowUnsafeObjects) {
      await this.tryAppendJobLog(
        jobId,
        'WARN',
        `Restore com allowUnsafeObjects=true (aprovacao manual assumida pelo operador; source=${artifactSource})`,
      );
    }

    if (protectedTables.length === 0) {
      return undefined;
    }

    const protectedTableMatchers = protectedTables.map((table) => {
      const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match table names as lexical units (schema/object names, index prefixes, constraints, etc).
      // We intentionally treat "_" as a separator to catch derived names like "<table>_...".
      return new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i');
    });

    const filtered = lines
      .map((line) => {
        if (!line.trim()) {
          return line;
        }
        if (line.trim().startsWith(';')) {
          return line;
        }

        return protectedTableMatchers.some((matcher) => matcher.test(line)) ? `; ${line}` : line;
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

  private assertDatabaseIdentifier(value: string, fieldName: string): string {
    const normalized = String(value || '').trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(normalized)) {
      throw new BadRequestException(`${fieldName} invalido para identificador de database`);
    }
    return normalized;
  }

  private assertTableIdentifier(value: string): string {
    const normalized = String(value || '').trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(normalized)) {
      throw new BadRequestException('table invalida para identificador PostgreSQL');
    }
    return normalized;
  }

  private quoteDatabaseIdentifier(value: string): string {
    const normalized = this.assertDatabaseIdentifier(value, 'database');
    return `"${normalized}"`;
  }

  private escapeSqlLiteral(value: string): string {
    return String(value).replace(/'/g, "''");
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

  private async withPrismaConnectionRetry<T>(operation: string, action: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await action();
      } catch (error) {
        lastError = error;
        if (
          this.prisma.isCutoverBlocked() ||
          !this.isRetryablePrismaConnectionError(error) ||
          attempt >= maxAttempts
        ) {
          throw error;
        }

        this.logger.warn(
          `Operacao Prisma "${operation}" falhou por conexao (tentativa ${attempt}/${maxAttempts}). Recriando conexao...`,
        );
        await this.tryRecoverPrismaConnection();
        await this.wait(250 * attempt);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private isRetryablePrismaConnectionError(error: unknown): boolean {
    const code = typeof (error as any)?.code === 'string' ? String((error as any).code).toUpperCase() : '';
    if (code === 'P1001' || code === 'P1017') {
      return true;
    }

    const message = this.errorMessage(error).toLowerCase();
    return (
      message.includes('server has closed the connection') ||
      message.includes('the database server closed the connection') ||
      message.includes('connection terminated unexpectedly') ||
      message.includes('connection closed') ||
      message.includes('already disconnected') ||
      message.includes("can't reach database server") ||
      message.includes('prisma client is already disconnected')
    );
  }

  private async tryRecoverPrismaConnection(): Promise<void> {
    try {
      await this.prisma.$disconnect();
    } catch {}

    if (this.prisma.isCutoverBlocked()) {
      return;
    }

    try {
      await this.prisma.$connect();
    } catch (error) {
      this.logger.warn(`Falha ao recriar conexao Prisma: ${this.errorMessage(error)}`);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      const commandResult = (error as any).result;
      if (commandResult?.stderr) {
        const stderr = String(commandResult.stderr);
        const tail = stderr.slice(-4000);
        const normalizedTail = tail.includes('\n') ? tail.slice(tail.indexOf('\n') + 1) : tail;
        return normalizedTail.trim() || stderr.trim() || error.message;
      }
      return error.message;
    }
    return String(error);
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

  private async resolveAuditActor(userId?: string | null): Promise<{ userId?: string; email?: string; role?: string } | undefined> {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      return undefined;
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: normalizedUserId },
        select: { id: true, email: true, role: true },
      });

      if (!user) {
        return { userId: normalizedUserId };
      }

      return {
        userId: user.id,
        email: user.email || undefined,
        role: user.role || undefined,
      };
    } catch {
      return { userId: normalizedUserId };
    }
  }

  private calculateDurationSeconds(startedAt?: Date | null, finishedAt: Date = new Date()): number | null {
    if (!startedAt) {
      return null;
    }

    const startedMs = startedAt.getTime();
    const finishedMs = finishedAt.getTime();

    if (!Number.isFinite(startedMs) || !Number.isFinite(finishedMs) || finishedMs < startedMs) {
      return null;
    }

    return Math.max(0, Math.round((finishedMs - startedMs) / 1000));
  }

  private resolveOperationSource(
    context?: RequestContext,
    fallback: BackupOperationSource = 'panel',
  ): BackupOperationSource {
    const explicit = this.normalizeOperationSource(context?.source);
    if (explicit) {
      return explicit;
    }

    const userAgent = String(context?.userAgent || '')
      .trim()
      .toLowerCase();

    if (!userAgent) {
      return fallback;
    }

    if (userAgent.includes('cron/')) {
      return 'cron';
    }

    if (userAgent.includes('wrapper') || userAgent.includes('restore-native') || userAgent.includes('internal')) {
      return 'wrapper';
    }

    if (userAgent.includes('system/')) {
      return 'system';
    }

    if (
      userAgent.includes('mozilla') ||
      userAgent.includes('chrome') ||
      userAgent.includes('safari') ||
      userAgent.includes('firefox') ||
      userAgent.includes('edg/')
    ) {
      return 'panel';
    }

    return fallback;
  }

  private resolveOperationSourceFromMetadata(
    metadata: Record<string, unknown> | null,
    fallback: BackupOperationSource,
  ): BackupOperationSource {
    return this.resolveOperationSource(
      {
        source: this.normalizeOperationSource(metadata?.source),
      },
      fallback,
    );
  }

  private normalizeOperationSource(input: unknown): BackupOperationSource | null {
    const value = String(input || '')
      .trim()
      .toLowerCase();
    if (value === 'panel' || value === 'cron' || value === 'system' || value === 'wrapper') {
      return value;
    }

    return null;
  }

  private readStringMetadata(metadata: Record<string, unknown> | null, key: string): string | null {
    const value = metadata?.[key];
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readNumberMetadata(metadata: Record<string, unknown> | null, key: string): number | null {
    const value = metadata?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    return null;
  }

  private sanitizeErrorForMetadata(message: string): string {
    let sanitized = String(message || '').trim();
    if (!sanitized) {
      return 'Erro desconhecido';
    }

    sanitized = sanitized.replace(
      /\b(authorization|proxy-authorization|cookie|set-cookie|x-maintenance-bypass)\b\s*[:=]\s*([^\n,;]+)/gi,
      '[redacted-header]',
    );
    sanitized = sanitized.replace(/\b(Bearer)\s+[A-Za-z0-9\-._~+/=]+/gi, '$1 [redacted]');
    sanitized = sanitized.replace(
      /\b(authorization|proxy-authorization|token|secret|password|passwd|api[-_]?key|x-api-key|x-maintenance-bypass|cookie|set-cookie)\b\s*[:=]\s*([^\s,;]+)/gi,
      '$1=[redacted]',
    );
    sanitized = sanitized.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[redacted-jwt]');
    sanitized = sanitized.replace(
      /((?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^:\s/]+:)([^@\s/]+)@/gi,
      '$1[redacted]@',
    );
    sanitized = sanitized.replace(/([A-Za-z]:)?[\\/](?:[^\\/\s'"`]+[\\/])*[^\\/\s'"`]+/g, '[path-redacted]');
    const inlineStackMatch = sanitized.match(
      /^(.*?)(?:\s+at\s+[^\n]+(?:\[path-redacted\]|:[0-9]+:[0-9]+).*)$/i,
    );
    if (inlineStackMatch) {
      const firstLine = (inlineStackMatch[1] || '').trim();
      sanitized = `${firstLine || 'Erro desconhecido'} [stack-redacted]`;
    }

    if (/\n/.test(sanitized)) {
      const normalizedLines = sanitized
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const firstLine = normalizedLines[0] || 'Erro desconhecido';
      const hasStackTrace = normalizedLines
        .slice(1)
        .some((line) => /^at\s+/i.test(line) || /:[0-9]+:[0-9]+/.test(line));

      sanitized = hasStackTrace ? `${firstLine} [stack-redacted]` : normalizedLines.join(' | ');
    }

    return sanitized.length > 1000 ? `${sanitized.slice(0, 997)}...` : sanitized;
  }

  private async notifyFailure(jobId: string, message: string): Promise<void> {
    try {
      const job = await this.prisma.backupJob.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          type: true,
          artifactId: true,
          metadata: true,
          createdByUserId: true,
          startedAt: true,
        },
      });

      const actor = await this.resolveAuditActor(job?.createdByUserId);
      const isRestore = job?.type === BackupJobType.RESTORE;
      const action = isRestore ? 'RESTORE_FAILED' : 'BACKUP_FAILED';
      const severity: 'warning' | 'critical' = isRestore ? 'critical' : 'warning';
      const normalizedError = String(message || 'Falha em job de backup/restore').slice(0, 1000);
      const sanitizedError = this.sanitizeErrorForMetadata(normalizedError);
      const metadata = this.toJsonRecord(job?.metadata);
      const source = this.resolveOperationSourceFromMetadata(metadata, isRestore ? 'panel' : 'system');

      const eventMetadata = isRestore
        ? {
            source,
            restoreId: jobId,
            backupId: job?.artifactId || null,
            durationSeconds: this.calculateDurationSeconds(job?.startedAt || null),
            lastError: sanitizedError,
          }
        : {
            source,
            jobId,
            backupType: this.readStringMetadata(metadata, 'backupType') || 'database_full',
            durationSeconds: this.calculateDurationSeconds(job?.startedAt || null),
            lastError: sanitizedError,
          };

      await this.auditService.log({
        action,
        severity,
        message: sanitizedError,
        actor,
        metadata: eventMetadata,
      });

      await this.notificationService.emitSystemAlert({
        action,
        severity,
        title: isRestore ? 'Restauracao falhou' : 'Backup falhou',
        body: isRestore
          ? 'A restauracao do sistema falhou e pode exigir intervencao.'
          : 'O backup do sistema falhou e precisa de verificacao.',
        data: eventMetadata,
        module: 'backup',
      });
    } catch (error) {
      this.logger.warn(`Falha ao emitir alerta de erro para job ${jobId}: ${String(error)}`);
    }
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateLockBackoffDelayMs(attempt: number): number {
    const baseMs = this.backupConfig.getLockBackoffBaseMs();
    const maxMs = this.backupConfig.getLockBackoffMaxMs();
    const exponent = Math.max(0, Math.min(30, attempt - 1));
    const coreDelay = Math.min(maxMs, baseMs * 2 ** exponent);
    const jitter = Math.floor(Math.random() * 301);
    return coreDelay + jitter;
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

  private async resolveInternalRestoreOperatorId(): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: {
        role: Role.SUPER_ADMIN,
        OR: [{ tenantId: null }, { tenant: { isMasterTenant: true } }],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (!user) {
      throw new ConflictException('Nenhum SUPER_ADMIN elegivel encontrado para restore interno');
    }

    return user.id;
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
