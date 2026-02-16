import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
  Res,
  UploadedFile,
  UseInterceptors,
  Sse,
  MessageEvent,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Observable, Subject } from 'rxjs';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { BackupService } from './backup.service';
import { CreateBackupDto } from './dto/create-backup.dto';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { SseJwtGuard } from './guards/sse-jwt.guard';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Controller responsável por endpoints de backup e restore
 * NOTA: Guards são aplicados individualmente por endpoint
 */
@Controller('api/backup')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);
  
  // Map para armazenar os subjects de progresso por sessão
  private progressSubjects = new Map<string, Subject<MessageEvent>>();

  constructor(private backupService: BackupService) {}

  /**
   * SSE endpoint para receber progresso do backup em tempo real
   * Autenticação via query string: ?token=xxx
   */
  @Sse('progress/:sessionId')
  @UseGuards(SseJwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  backupProgress(@Param('sessionId') sessionId: string): Observable<MessageEvent> {
    let subject = this.progressSubjects.get(sessionId);
    
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.progressSubjects.set(sessionId, subject);
    }

    return subject.asObservable();
  }

  /**
   * POST /api/backup/create
   * Cria backup completo do banco de dados
   * Requer autenticação JWT e role SUPER_ADMIN
   */
  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 por hora
  async createBackup(@Body() dto: CreateBackupDto, @Request() req) {
    try {
      const userId = req.user?.id || req.user?.sub;
      
      if (!userId) {
        throw new HttpException(
          'Usuário não autenticado',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const ipAddress = req.ip;
      const sessionId = dto.sessionId || `session_${Date.now()}`;

      // Criar subject para esta sessão
      if (!this.progressSubjects.has(sessionId)) {
        this.progressSubjects.set(sessionId, new Subject<MessageEvent>());
      }

      // Callback de progresso
      const progressCallback = (message: string) => {
        const subject = this.progressSubjects.get(sessionId);
        if (subject) {
          subject.next({ data: { message, timestamp: Date.now() } } as MessageEvent);
        }
      };

      const result = await this.backupService.createBackup(dto, userId, ipAddress, progressCallback);

      // Enviar mensagem final
      const subject = this.progressSubjects.get(sessionId);
      if (subject) {
        subject.next({ data: { message: 'Backup concluído!', completed: true } } as MessageEvent);
        subject.complete();
        this.progressSubjects.delete(sessionId);
      }

      return {
        success: true,
        message: 'Backup criado com sucesso',
        data: { ...result, sessionId },
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Erro ao criar backup',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/backup/download/:backupId
   * Faz download do arquivo de backup
   * Autenticação via query string: ?token=xxx
   */
  @Get('download/:backupId')
  @UseGuards(SseJwtGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async downloadBackup(
    @Param('backupId') backupId: string,
    @Res() res: Response,
  ) {
    try {
      const backupInfo = await this.backupService.getBackupInfo(backupId);

      if (!backupInfo) {
        throw new HttpException('Backup não encontrado', HttpStatus.NOT_FOUND);
      }

      const filePath = path.join(
        this.backupService['tempDir'],
        backupInfo.fileName,
      );

      if (!fs.existsSync(filePath)) {
        throw new HttpException(
          'Arquivo de backup não encontrado',
          HttpStatus.NOT_FOUND,
        );
      }

      // Configurar headers para download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${backupInfo.fileName}"`,
      );
      res.setHeader('Content-Length', backupInfo.fileSize.toString());

      // Enviar arquivo
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      throw new HttpException(
        error.message || 'Erro ao fazer download',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/backup/restore
   * Restaura banco de dados a partir de arquivo de backup
   * Requer autenticação JWT e role SUPER_ADMIN
   */
  @Post('restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 por hora (aumentado para testes)
  @UseInterceptors(FileInterceptor('file'))
  async restoreBackup(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: RestoreBackupDto,
    @Request() req,
  ) {
    try {
      // Validar confirmação
      if (dto.confirmationText !== 'CONFIRMAR') {
        throw new HttpException(
          'Confirmação inválida. Digite "CONFIRMAR" para prosseguir',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!file) {
        throw new HttpException(
          'Arquivo de backup não fornecido',
          HttpStatus.BAD_REQUEST,
        );
      }

      const userId = req.user?.id || req.user?.sub;
      
      if (!userId) {
        throw new HttpException(
          'Usuário não autenticado',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const ipAddress = req.ip;

      const result = await this.backupService.restoreBackup(
        file,
        userId,
        ipAddress,
      );

      return {
        success: true,
        message: 'Restore executado com sucesso',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Erro ao executar restore',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/backup/validate
   * Valida arquivo de backup
   */
  @Post('validate')
  @UseInterceptors(FileInterceptor('file'))
  async validateBackup(@UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        throw new HttpException(
          'Arquivo não fornecido',
          HttpStatus.BAD_REQUEST,
        );
      }

      const validationResult = await this.backupService.validateBackupFile(file);

      return {
        valid: validationResult.valid,
        fileInfo: validationResult.info,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Erro ao validar arquivo',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/backup/available
   * Lista todos os arquivos de backup disponíveis
   * Requer autenticação JWT e role SUPER_ADMIN
   */
  @Get('available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async getAvailableBackups() {
    try {
      const backups = await this.backupService.listAvailableBackups();

      return {
        success: true,
        data: backups.map(backup => ({
          fileName: backup.fileName,
          fileSize: backup.fileSize,
          createdAt: backup.createdAt,
          backupId: backup.backupId,
        })),
        total: backups.length,
      };
    } catch (error) {
      throw new HttpException(
        'Erro ao listar backups',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/backup/download-file/:fileName
   * Faz download do arquivo de backup pelo nome do arquivo
   * ENDPOINT PÚBLICO - Sem autenticação JWT
   */
  @Get('download-file/:fileName')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async downloadBackupFile(
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    try {
      if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
        throw new HttpException('Nome de arquivo invalido', HttpStatus.BAD_REQUEST);
      }

      const normalizedName = path.basename(fileName);
      if (normalizedName !== fileName) {
        throw new HttpException('Nome de arquivo invalido', HttpStatus.BAD_REQUEST);
      }

      const backupsDir = path.resolve(this.backupService.getBackupsDir());
      const candidatePath = path.resolve(path.join(backupsDir, normalizedName));
      if (!candidatePath.startsWith(backupsDir + path.sep)) {
        throw new HttpException('Acesso a caminho invalido', HttpStatus.BAD_REQUEST);
      }
      const backups = await this.backupService.listAvailableBackups();
      const backup = backups.find(b => b.fileName === normalizedName);

      if (!backup) {
        throw new HttpException('Backup não encontrado', HttpStatus.NOT_FOUND);
      }

      if (!fs.existsSync(backup.filePath)) {
        throw new HttpException(
          'Arquivo de backup não encontrado',
          HttpStatus.NOT_FOUND,
        );
      }

      // Configurar headers para forçar download (não abrir em nova aba)
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${backup.fileName}"`,
      );
      res.setHeader('Content-Length', backup.fileSize.toString());
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Enviar arquivo como stream
      const fileStream = fs.createReadStream(backup.filePath);
      
      // Tratar erros no stream
      fileStream.on('error', (error) => {
        this.logger.error(`Erro ao ler arquivo de backup: ${error.message}`);
        if (!res.headersSent) {
          res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Erro ao ler arquivo de backup',
          });
        }
      });

      fileStream.pipe(res);
    } catch (error) {
      this.logger.error(`Erro no download: ${error.message}`);
      throw new HttpException(
        error.message || 'Erro ao fazer download',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * DELETE /api/backup/delete/:fileName
   * Apaga um arquivo de backup
   * Requer autenticação JWT e role SUPER_ADMIN
   */
  @Delete('delete/:fileName')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 por hora
  async deleteBackup(
    @Param('fileName') fileName: string,
    @Request() req,
  ) {
    try {
      const userId = req.user?.id || req.user?.sub;
      
      if (!userId) {
        throw new HttpException(
          'Usuário não autenticado',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const result = await this.backupService.deleteBackup(fileName, userId);

      return {
        success: true,
        message: 'Backup apagado com sucesso',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Erro ao apagar backup: ${error.message}`);
      throw new HttpException(
        error.message || 'Erro ao apagar backup',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/backup/logs
   * Retorna histórico de operações
   * Requer autenticação JWT e role SUPER_ADMIN
   */
  @Get('logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async getLogs(
    @Query('limit') limit?: string,
    @Query('operationType') operationType?: 'BACKUP' | 'RESTORE',
    @Query('status') status?: 'STARTED' | 'SUCCESS' | 'FAILED' | 'CANCELLED',
  ) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 50;

      if (limitNum > 200) {
        throw new HttpException(
          'Limite máximo de 200 registros',
          HttpStatus.BAD_REQUEST,
        );
      }

      const logs = await this.backupService.getBackupLogs(
        limitNum,
        operationType,
        status,
      );

      return {
        success: true,
        data: logs,
        total: logs.length,
      };
    } catch (error) {
      throw new HttpException(
        'Erro ao buscar logs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

