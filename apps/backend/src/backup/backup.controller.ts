import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { InternalRestoreByFileRequestDto } from './dto/internal-restore-job.dto';
import { RestoreJobDto } from './dto/restore-job.dto';
import { BackupService } from './backup.service';
import { BackupInternalGuard } from './guards/backup-internal.guard';

const MAX_UPLOAD_SIZE = Number(process.env.BACKUP_MAX_SIZE || 2 * 1024 * 1024 * 1024);

function requestContext(req: any): { ipAddress?: string; userAgent?: string } {
  return {
    ipAddress: req.ip,
    userAgent: req.headers?.['user-agent'],
  };
}

@Controller('backups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class BackupsController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  async createBackupJob(@Request() req) {
    const userId = req.user?.id || req.user?.sub;
    const job = await this.backupService.createBackupJob(userId, requestContext(req));
    return {
      success: true,
      message: 'Job de backup enfileirado',
      data: {
        jobId: job.id,
        status: job.status,
        type: job.type,
      },
    };
  }

  @Get()
  async listBackupsAndJobs(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit || 50);
    const data = await this.backupService.listBackupsAndJobs(parsedLimit);
    return {
      success: true,
      data,
    };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_UPLOAD_SIZE,
        files: 1,
      },
    }),
  )
  async uploadBackup(@UploadedFile() file: Express.Multer.File, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    const artifact = await this.backupService.uploadBackup(file, userId, requestContext(req));
    return {
      success: true,
      message: 'Upload concluido',
      data: {
        artifactId: artifact.id,
        fileName: artifact.fileName,
        fileSize: Number(artifact.sizeBytes),
        checksumSha256: artifact.checksumSha256,
        createdAt: artifact.createdAt,
      },
    };
  }

  @Post(':id/restore')
  async restoreExistingBackup(@Param('id') artifactId: string, @Body() dto: RestoreJobDto, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    const job = await this.backupService.queueRestoreFromArtifact(
      artifactId,
      userId,
      dto || {},
      requestContext(req),
    );
    return {
      success: true,
      message: 'Job de restore enfileirado',
      data: {
        jobId: job.id,
        status: job.status,
      },
    };
  }

  @Post('restore-from-upload/:uploadId')
  async restoreFromUpload(@Param('uploadId') uploadId: string, @Body() dto: RestoreJobDto, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    const job = await this.backupService.queueRestoreFromUpload(
      uploadId,
      userId,
      dto || {},
      requestContext(req),
    );
    return {
      success: true,
      message: 'Job de restore enfileirado',
      data: {
        jobId: job.id,
        status: job.status,
      },
    };
  }

  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.backupService.getJobStatus(jobId);
    return {
      success: true,
      data: {
        ...job,
        sizeBytes: job.sizeBytes ? Number(job.sizeBytes) : null,
      },
    };
  }

  @Post('jobs/:jobId/cancel')
  async cancelJob(@Param('jobId') jobId: string, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    const job = await this.backupService.cancelPendingJob(jobId, userId);
    return {
      success: true,
      message: 'Job cancelado',
      data: {
        jobId: job.id,
        status: job.status,
      },
    };
  }

  @Get(':id/download')
  async downloadByArtifactId(@Param('id') artifactId: string, @Res() res: Response) {
    const download = await this.backupService.resolveArtifactDownload(artifactId);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=\"${download.fileName}\"`);
    res.setHeader('Content-Length', String(download.size));
    res.sendFile(download.filePath);
  }

  @Get('maintenance/state')
  async maintenanceState() {
    return {
      success: true,
      data: this.backupService.getMaintenanceState(),
    };
  }
}

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class BackupLegacyController {
  constructor(private readonly backupService: BackupService) {}

  @Post('create')
  async create(@Request() req) {
    const userId = req.user?.id || req.user?.sub;
    const job = await this.backupService.createBackupJob(userId, requestContext(req));
    return {
      success: true,
      message: 'Backup enfileirado',
      data: {
        jobId: job.id,
        status: job.status,
      },
    };
  }

  @Get('available')
  async available() {
    const artifacts = await this.backupService.listAvailableArtifacts(200);
    return {
      success: true,
      data: artifacts.map((artifact) => ({
        backupId: artifact.id,
        fileName: artifact.fileName,
        fileSize: Number(artifact.sizeBytes),
        createdAt: artifact.createdAt,
      })),
    };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_UPLOAD_SIZE,
        files: 1,
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    const artifact = await this.backupService.uploadBackup(file, userId, requestContext(req));
    return {
      success: true,
      message: 'Arquivo de backup enviado com sucesso',
      data: {
        artifactId: artifact.id,
        fileName: artifact.fileName,
      },
    };
  }

  @Post('restore')
  async restore(@Body() body: { backupFile: string } & RestoreJobDto, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    const artifact = await this.backupService.findArtifactByFileName(body.backupFile);
    const job = await this.backupService.queueRestoreFromArtifact(
      artifact.id,
      userId,
      body || {},
      requestContext(req),
    );
    return {
      success: true,
      message: 'Restore enfileirado',
      data: {
        restoreLogId: job.id,
      },
    };
  }

  @Get('restore-logs/:id')
  async restoreLog(@Param('id') jobId: string) {
    const job = await this.backupService.getJobStatus(jobId);
    return {
      success: true,
      data: {
        id: job.id,
        status: job.status,
        fileName: job.fileName,
        startedAt: job.startedAt || job.createdAt,
        completedAt: job.finishedAt,
        errorMessage: job.error,
        logs: job.logs,
      },
    };
  }

  @Get('logs')
  async logs(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit || 50);
    const data = await this.backupService.listLegacyLogs(parsedLimit);
    return { success: true, data };
  }

  @Get('download-file/:fileName')
  async downloadByFileName(@Param('fileName') fileName: string, @Res() res: Response) {
    const download = await this.backupService.resolveArtifactByFileName(fileName);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=\"${download.fileName}\"`);
    res.setHeader('Content-Length', String(download.size));
    res.sendFile(download.filePath);
  }

  @Delete('delete/:fileName')
  @HttpCode(HttpStatus.OK)
  async deleteBackup(@Param('fileName') fileName: string, @Request() req) {
    const userId = req.user?.id || req.user?.sub;
    await this.backupService.deleteArtifactByFileName(fileName, userId);
    return { success: true, message: 'Backup apagado com sucesso' };
  }
}

@Controller('backups/internal')
@UseGuards(BackupInternalGuard)
export class BackupInternalController {
  constructor(private readonly backupService: BackupService) {}

  @Post('restore-by-file')
  async restoreByFile(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    body: InternalRestoreByFileRequestDto,
    @Request() req,
  ) {
    const options = {
      runMigrations: body.runMigrations ?? false,
      reason: body.reason,
    };

    const job = await this.backupService.queueInternalRestoreByFileName(body.backupFile, options, requestContext(req));
    return {
      success: true,
      message: 'Job de restore interno enfileirado',
      data: {
        jobId: job.id,
        status: job.status,
      },
    };
  }

  @Get('jobs/:jobId')
  async internalJobStatus(@Param('jobId') jobId: string) {
    const job = await this.backupService.getJobStatus(jobId);
    return {
      success: true,
      data: {
        id: job.id,
        type: job.type,
        status: job.status,
        failed: job.status === 'FAILED',
        currentStep: job.currentStep,
        progressPercent: job.progressPercent,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      },
    };
  }
}
