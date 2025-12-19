import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/prisma/prisma.service';
import { createReadStream, promises as fsPromises } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  SecureFileUploadResponse,
  SecureFileMetadata,
  SecureFileStream,
} from './interfaces/secure-file.interface';
import {
  validateFileSignature,
  sanitizeFileName,
} from './config/secure-multer.config';

@Injectable()
export class SecureFilesService {
  private readonly logger = new Logger(SecureFilesService.name);
  private readonly uploadsRoot: string;
  private readonly secureDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Configurar paths dinâmicos (Docker-ready)
    this.uploadsRoot = join(
      process.cwd(),
      this.configService.get<string>('UPLOADS_ROOT', 'uploads'),
    );
    this.secureDir = join(this.uploadsRoot, 'secure');
  }

  /**
   * Realiza upload de arquivo sensível
   */
  async uploadFile(
    file: Express.Multer.File,
    tenantId: string,
    moduleName: string,
    documentType: string,
    userId: string,
    metadata?: string,
  ): Promise<SecureFileUploadResponse> {
    this.logger.log(
      `Iniciando upload: tenant=${tenantId}, module=${moduleName}, type=${documentType}`,
    );

    try {
      // 1. Validar assinatura do arquivo
      await this.validateFileContent(file);

      // 2. Sanitizar nome original
      const sanitizedName = sanitizeFileName(file.originalname);

      // 3. Gerar nome único para armazenamento
      const extension = file.originalname.split('.').pop();
      const storedName = `${uuidv4()}.${extension}`;

      // 4. Criar diretório dinâmico
      const filePath = await this.createSecureDirectory(
        tenantId,
        moduleName,
        documentType,
        storedName,
      );

      // 5. Mover arquivo para destino final
      await fsPromises.rename(file.path, filePath);

      // 6. Registrar metadata no banco
      const secureFile = await this.prisma.secureFile.create({
        data: {
          id: uuidv4(),
          tenantId,
          moduleName,
          documentType,
          originalName: sanitizedName,
          storedName,
          mimeType: file.mimetype,
          sizeBytes: BigInt(file.size),
          uploadedBy: userId,
          metadata: metadata || null,
        },
      });

      this.logger.log(`Upload concluído: fileId=${secureFile.id}`);

      // 7. Registrar em auditoria
      await this.logAuditEvent('SECURE_FILE_UPLOADED', userId, tenantId, {
        fileId: secureFile.id,
        moduleName,
        documentType,
        sizeBytes: file.size,
      });

      return {
        fileId: secureFile.id,
        originalName: sanitizedName,
        sizeBytes: file.size,
        uploadedAt: secureFile.uploadedAt,
        moduleName,
        documentType,
      };
    } catch (error) {
      this.logger.error(`Erro no upload: ${error.message}`, error.stack);

      // Tentar deletar arquivo se foi criado
      if (file.path) {
        try {
          await fsPromises.unlink(file.path);
        } catch (unlinkError) {
          this.logger.warn(`Não foi possível deletar arquivo temporário: ${file.path}`);
        }
      }

      throw new InternalServerErrorException(
        'Erro ao processar upload. Tente novamente.',
      );
    }
  }

  /**
   * Obtém stream do arquivo para download/visualização
   */
  async getFileStream(
    fileId: string,
    userId: string,
    tenantId: string,
  ): Promise<SecureFileStream> {
    // 1. Buscar metadata do arquivo
    const file = await this.prisma.secureFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('Arquivo não encontrado');
    }

    // 2. Validar que arquivo pertence ao tenant
    if (file.tenantId !== tenantId) {
      this.logger.warn(
        `Tentativa de acesso cross-tenant: user=${userId}, file=${fileId}`,
      );
      throw new NotFoundException('Arquivo não encontrado');
    }

    // 3. Verificar se arquivo foi deletado (soft delete)
    if (file.deletedAt) {
      throw new NotFoundException('Arquivo foi deletado');
    }

    // 4. Construir path do arquivo
    const filePath = this.getFilePath(
      file.tenantId,
      file.moduleName,
      file.documentType,
      file.storedName,
    );

    // 5. Verificar se arquivo existe fisicamente
    try {
      await fsPromises.access(filePath);
    } catch {
      this.logger.error(`Arquivo físico não encontrado: ${filePath}`);
      throw new NotFoundException('Arquivo corrompido ou não encontrado');
    }

    // 6. Atualizar estatísticas de acesso
    await this.prisma.secureFile.update({
      where: { id: fileId },
      data: {
        lastAccessedAt: new Date(),
        accessCount: {
          increment: 1,
        },
      },
    });

    // 7. Registrar acesso em auditoria
    await this.logAuditEvent('SECURE_FILE_ACCESSED', userId, tenantId, {
      fileId,
      moduleName: file.moduleName,
      documentType: file.documentType,
    });

    // 8. Obter stats do arquivo para Content-Length
    const stats = await fsPromises.stat(filePath);

    // 9. Criar stream
    const stream = createReadStream(filePath);

    return {
      stream,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': stats.size,
        'Content-Disposition': `inline; filename="${file.originalName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    };
  }

  /**
   * Obtém metadata do arquivo
   */
  async getFileMetadata(
    fileId: string,
    tenantId: string,
  ): Promise<SecureFileMetadata> {
    const file = await this.prisma.secureFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('Arquivo não encontrado');
    }

    if (file.tenantId !== tenantId) {
      throw new NotFoundException('Arquivo não encontrado');
    }

    if (file.deletedAt) {
      throw new NotFoundException('Arquivo foi deletado');
    }

    return {
      fileId: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: Number(file.sizeBytes),
      uploadedAt: file.uploadedAt,
      lastAccessedAt: file.lastAccessedAt,
      accessCount: file.accessCount,
    };
  }

  /**
   * Deleta arquivo (soft delete)
   */
  async deleteFile(
    fileId: string,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const file = await this.prisma.secureFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('Arquivo não encontrado');
    }

    if (file.tenantId !== tenantId) {
      throw new NotFoundException('Arquivo não encontrado');
    }

    if (file.deletedAt) {
      throw new BadRequestException('Arquivo já foi deletado');
    }

    // Soft delete
    await this.prisma.secureFile.update({
      where: { id: fileId },
      data: {
        deletedAt: new Date(),
      },
    });

    // Registrar em auditoria
    await this.logAuditEvent('SECURE_FILE_DELETED', userId, tenantId, {
      fileId,
      moduleName: file.moduleName,
      documentType: file.documentType,
    });

    this.logger.log(`Arquivo deletado (soft): fileId=${fileId}`);
  }

  /**
   * Lista arquivos do tenant com filtros opcionais
   */
  async listFiles(
    tenantId: string,
    moduleName?: string,
    documentType?: string,
  ) {
    const where: any = {
      tenantId,
      deletedAt: null, // Apenas arquivos não deletados
    };

    if (moduleName) {
      where.moduleName = moduleName;
    }

    if (documentType) {
      where.documentType = documentType;
    }

    const files = await this.prisma.secureFile.findMany({
      where,
      select: {
        id: true,
        moduleName: true,
        documentType: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        uploadedAt: true,
        lastAccessedAt: true,
        accessCount: true,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return files.map((file) => ({
      ...file,
      sizeBytes: Number(file.sizeBytes),
    }));
  }

  /**
   * Cria diretório seguro dinamicamente
   */
  private async createSecureDirectory(
    tenantId: string,
    moduleName: string,
    documentType: string,
    fileName: string,
  ): Promise<string> {
    const directoryPath = join(
      this.secureDir,
      'tenants',
      tenantId,
      'modules',
      moduleName,
      documentType,
    );

    // Criar diretório recursivamente se não existir
    await fsPromises.mkdir(directoryPath, { recursive: true });

    return join(directoryPath, fileName);
  }

  /**
   * Obtém path do arquivo
   */
  private getFilePath(
    tenantId: string,
    moduleName: string,
    documentType: string,
    fileName: string,
  ): string {
    return join(
      this.secureDir,
      'tenants',
      tenantId,
      'modules',
      moduleName,
      documentType,
      fileName,
    );
  }

  /**
   * Valida conteúdo do arquivo (assinatura)
   */
  private async validateFileContent(file: Express.Multer.File): Promise<void> {
    // Ler primeiros bytes do arquivo
    const buffer = await fsPromises.readFile(file.path);

    // Validar assinatura
    if (!validateFileSignature(buffer, file.mimetype)) {
      // Deletar arquivo inválido
      await fsPromises.unlink(file.path);
      throw new BadRequestException(
        'Assinatura de arquivo inválida. O arquivo pode estar corrompido.',
      );
    }

    // Validar tamanho mínimo (evitar arquivos vazios ou muito pequenos)
    if (buffer.length < 100) {
      await fsPromises.unlink(file.path);
      throw new BadRequestException(
        'Arquivo muito pequeno ou corrompido',
      );
    }
  }

  /**
   * Registra evento de auditoria
   */
  private async logAuditEvent(
    action: string,
    userId: string,
    tenantId: string,
    details: any,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          userId,
          tenantId,
          details: JSON.stringify(details),
        },
      });
    } catch (error) {
      this.logger.warn(`Falha ao registrar auditoria: ${error.message}`);
      // Não falhar a operação principal por falha na auditoria
    }
  }
}
