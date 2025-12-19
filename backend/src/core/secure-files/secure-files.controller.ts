import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { SecureFileAccessGuard } from './guards/secure-file-access.guard';
import { SecureFilesService } from './secure-files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileQueryDto } from './dto/file-query.dto';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

/**
 * Controller para gerenciamento de arquivos sensíveis
 * Todos os endpoints protegidos por JWT
 */
@Controller('secure-files')
@UseGuards(JwtAuthGuard)
export class SecureFilesController {
  constructor(
    private readonly secureFilesService: SecureFilesService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Upload de arquivo sensível
   * POST /secure-files/upload
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/temp',
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      limits: {
        fileSize: 10485760, // 10MB default, será sobrescrito por env
      },
      fileFilter: (req, file, cb) => {
        // Validação básica de MIME type
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];

        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Tipo de arquivo não permitido: ${file.mimetype}`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadFileDto,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    const user = req.user;
    const tenantId = user.tenantId;
    const userId = user.id;

    return await this.secureFilesService.uploadFile(
      file,
      tenantId,
      uploadDto.moduleName,
      uploadDto.documentType,
      userId,
      uploadDto.metadata,
    );
  }

  /**
   * Download/streaming de arquivo
   * GET /secure-files/:fileId
   */
  @Get(':fileId')
  @UseGuards(SecureFileAccessGuard)
  async getFile(
    @Param('fileId') fileId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const user = req.user;
    const { stream, headers } = await this.secureFilesService.getFileStream(
      fileId,
      user.id,
      user.tenantId,
    );

    // Definir headers de resposta
    res.set(headers);

    // Fazer pipe do stream para response
    stream.pipe(res);
  }

  /**
   * Obter metadata do arquivo
   * GET /secure-files/:fileId/metadata
   */
  @Get(':fileId/metadata')
  @UseGuards(SecureFileAccessGuard)
  async getFileMetadata(@Param('fileId') fileId: string, @Req() req: any) {
    const user = req.user;
    return await this.secureFilesService.getFileMetadata(fileId, user.tenantId);
  }

  /**
   * Deletar arquivo (soft delete)
   * DELETE /secure-files/:fileId
   */
  @Delete(':fileId')
  @UseGuards(SecureFileAccessGuard)
  async deleteFile(@Param('fileId') fileId: string, @Req() req: any) {
    const user = req.user;
    await this.secureFilesService.deleteFile(fileId, user.id, user.tenantId);
    return { message: 'Arquivo deletado com sucesso' };
  }

  /**
   * Listar arquivos do tenant
   * GET /secure-files/list
   */
  @Get()
  async listFiles(@Query() query: FileQueryDto, @Req() req: any) {
    const user = req.user;
    return await this.secureFilesService.listFiles(
      user.tenantId,
      query.moduleName,
      query.documentType,
    );
  }
}
