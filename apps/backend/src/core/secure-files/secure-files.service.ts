import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/prisma/prisma.service';
import { PathsService } from '@core/common/paths/paths.service';
import { createReadStream, promises as fsPromises } from 'fs';
import { resolve, sep } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  SecureFileMetadata,
  SecureFileStream,
  SecureFileUploadResponse,
} from './interfaces/secure-file.interface';
import { sanitizeFileName, validateFileSignature } from './config/secure-multer.config';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { AuthorizationService } from '@common/services/authorization.service';

type SecureFileActor = {
  id: string;
  tenantId: string | null;
  role: string | null;
};

type SecureFileActorInput = Partial<SecureFileActor> | null | undefined;

@Injectable()
export class SecureFilesService {
  private readonly logger = new Logger(SecureFilesService.name);
  private readonly uploadsRoot: string;
  private readonly tempDir: string;
  private readonly secureDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pathsService: PathsService,
    private readonly configResolver: ConfigResolverService,
    private readonly authorizationService: AuthorizationService,
  ) {
    this.uploadsRoot = this.pathsService.ensureDir(this.pathsService.getUploadsDir());
    this.tempDir = this.pathsService.ensureDir(this.pathsService.getTempDir());
    this.secureDir = this.pathsService.ensureDir(this.pathsService.getSecureDir());
  }

  async uploadFile(
    file: Express.Multer.File,
    tenantId: string,
    moduleName: string,
    documentType: string,
    userId: string,
    metadata?: string,
  ): Promise<SecureFileUploadResponse> {
    this.logger.log(`Starting secure upload: tenant=${tenantId}, module=${moduleName}, type=${documentType}`);

    try {
      await this.validateFileContent(file);

      const safeTenantId = this.validatePathSegment(tenantId, 'tenantId');
      const safeModuleName = this.validatePathSegment(moduleName, 'moduleName');
      const safeDocumentType = this.validatePathSegment(documentType, 'documentType');
      await this.assertTenantModuleAccess(safeTenantId, safeModuleName, 'write');

      const sanitizedName = sanitizeFileName(file.originalname);
      const safeExtension = this.extractSafeExtension(file.originalname);
      const storedName = `${uuidv4()}.${safeExtension}`;

      const filePath = await this.createSecureDirectory(
        safeTenantId,
        safeModuleName,
        safeDocumentType,
        storedName,
      );
      await fsPromises.rename(file.path, filePath);

      const secureFile = await this.prisma.secureFile.create({
        data: {
          id: uuidv4(),
          tenantId: safeTenantId,
          moduleName: safeModuleName,
          documentType: safeDocumentType,
          originalName: sanitizedName,
          storedName,
          mimeType: file.mimetype,
          sizeBytes: BigInt(file.size),
          uploadedBy: userId,
          metadata: metadata || null,
        },
      });

      await this.logAuditEvent('SECURE_FILE_UPLOADED', userId, safeTenantId, {
        fileId: secureFile.id,
        moduleName: safeModuleName,
        documentType: safeDocumentType,
        sizeBytes: file.size,
      });

      return {
        fileId: secureFile.id,
        originalName: sanitizedName,
        sizeBytes: file.size,
        uploadedAt: secureFile.uploadedAt,
        moduleName: safeModuleName,
        documentType: safeDocumentType,
      };
    } catch (error) {
      this.logger.error(`Secure upload failed: ${error.message}`, error.stack);

      if (file.path) {
        try {
          await fsPromises.unlink(file.path);
        } catch {
          this.logger.warn(`Falha ao remover arquivo temporario: ${file.path}`);
        }
      }

      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to process secure upload.');
    }
  }

  async getFileStream(fileId: string, actorInput: SecureFileActorInput): Promise<SecureFileStream> {
    const actor = this.normalizeActor(actorInput);
    const file = await this.getAccessibleFileOrThrow(fileId, actor, 'read');

    const filePath = this.getFilePath(
      file.tenantId,
      file.moduleName,
      file.documentType,
      file.storedName,
    );

    try {
      await fsPromises.access(filePath);
    } catch {
      this.logger.error(`Secure file missing on disk: ${filePath}`);
      throw new NotFoundException('File not found on disk');
    }

    await this.prisma.secureFile.update({
      where: { id: fileId },
      data: {
        lastAccessedAt: new Date(),
        accessCount: { increment: 1 },
      },
    });

    await this.logAuditEvent('SECURE_FILE_ACCESSED', actor.id, file.tenantId, {
      fileId,
      moduleName: file.moduleName,
      documentType: file.documentType,
    });

    const stats = await fsPromises.stat(filePath);
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

  async getFileMetadata(fileId: string, actorInput: SecureFileActorInput): Promise<SecureFileMetadata> {
    const actor = this.normalizeActor(actorInput);
    const file = await this.getAccessibleFileOrThrow(fileId, actor, 'read');

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

  async deleteFile(fileId: string, actorInput: SecureFileActorInput): Promise<void> {
    const actor = this.normalizeActor(actorInput);
    const file = await this.getAccessibleFileOrThrow(fileId, actor, 'delete');
    await this.assertTenantModuleAccess(file.tenantId, file.moduleName, 'write');

    await this.prisma.secureFile.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });

    await this.logAuditEvent('SECURE_FILE_DELETED', actor.id, file.tenantId, {
      fileId,
      moduleName: file.moduleName,
      documentType: file.documentType,
    });
  }

  async listFiles(actorInput: SecureFileActorInput, tenantId: string, moduleName?: string, documentType?: string) {
    const actor = this.normalizeActor(actorInput);
    const safeTenantId = this.validatePathSegment(tenantId, 'tenantId');
    const safeModuleName = moduleName
      ? this.validatePathSegment(moduleName, 'moduleName')
      : undefined;
    const safeDocumentType = documentType
      ? this.validatePathSegment(documentType, 'documentType')
      : undefined;

    if (safeModuleName) {
      await this.assertTenantModuleAccess(safeTenantId, safeModuleName, 'read');
    }

    const where = this.authorizationService.buildSecureFileListWhere(actor, {
      deletedAt: null,
      tenantId: safeTenantId,
    }) as Prisma.SecureFileWhereInput;

    if (safeModuleName) {
      where.moduleName = safeModuleName;
    }

    if (safeDocumentType) {
      where.documentType = safeDocumentType;
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
      orderBy: { uploadedAt: 'desc' },
    });

    return files.map((file) => ({
      ...file,
      sizeBytes: Number(file.sizeBytes),
    }));
  }

  private async createSecureDirectory(
    tenantId: string,
    moduleName: string,
    documentType: string,
    fileName: string,
  ): Promise<string> {
    const directoryPath = this.safeJoinWithinBase(
      this.secureDir,
      'tenants',
      tenantId,
      'modules',
      moduleName,
      documentType,
    );

    await fsPromises.mkdir(directoryPath, { recursive: true });
    return this.safeJoinWithinBase(directoryPath, fileName);
  }

  private getFilePath(
    tenantId: string,
    moduleName: string,
    documentType: string,
    fileName: string,
  ): string {
    return this.safeJoinWithinBase(
      this.secureDir,
      'tenants',
      tenantId,
      'modules',
      moduleName,
      documentType,
      fileName,
    );
  }

  private validatePathSegment(value: string, fieldName: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      throw new BadRequestException(`${fieldName} is invalid`);
    }

    if (
      normalized.includes('..') ||
      normalized.includes('/') ||
      normalized.includes('\\') ||
      normalized.includes('\0')
    ) {
      throw new ForbiddenException('Path traversal detected');
    }

    return normalized;
  }

  private safeJoinWithinBase(basePath: string, ...segments: string[]): string {
    const normalizedBase = resolve(basePath);
    const safeSegments = segments.map((segment, index) =>
      this.validatePathSegment(segment, `path_segment_${index}`),
    );
    const resolvedPath = resolve(normalizedBase, ...safeSegments);

    if (resolvedPath !== normalizedBase && !resolvedPath.startsWith(`${normalizedBase}${sep}`)) {
      throw new ForbiddenException('Path traversal detected');
    }

    return resolvedPath;
  }

  private extractSafeExtension(fileName: string): string {
    const rawExtension = String(fileName || '')
      .split('.')
      .pop()
      ?.trim()
      .toLowerCase();
    const sanitized = sanitizeFileName(rawExtension || 'bin').replace(/^\.+/, '');
    return sanitized || 'bin';
  }

  private async assertTenantModuleAccess(
    tenantId: string,
    moduleName: string,
    mode: 'read' | 'write',
  ): Promise<void> {
    const safeTenantId = this.validatePathSegment(tenantId, 'tenantId');
    const safeModuleName = this.validatePathSegment(moduleName, 'moduleName');
    const moduleRecord = await this.prisma.module.findUnique({
      where: { slug: safeModuleName },
      select: { id: true },
    });

    if (!moduleRecord) {
      this.logger.warn(
        `Secure file access denied due to unknown module. tenant=${safeTenantId} module=${safeModuleName} mode=${mode}`,
      );
      throw new ForbiddenException(`Module ${safeModuleName} not found`);
    }

    const tenantModule = await this.prisma.moduleTenant.findUnique({
      where: {
        moduleId_tenantId: {
          moduleId: moduleRecord.id,
          tenantId: safeTenantId,
        },
      },
      select: { enabled: true },
    });

    if (!tenantModule?.enabled) {
      throw new ForbiddenException(`Module ${safeModuleName} is not enabled for this tenant`);
    }
  }

  private async validateFileContent(file: Express.Multer.File): Promise<void> {
    const buffer = await fsPromises.readFile(file.path);

    const signatureValidationEnabled =
      (await this.configResolver.getBoolean('security.file_signature_validation.enabled')) !== false;

    if (signatureValidationEnabled && !validateFileSignature(buffer, file.mimetype)) {
      await fsPromises.unlink(file.path);
      throw new BadRequestException('Invalid file signature');
    }

    if (buffer.length < 100) {
      await fsPromises.unlink(file.path);
      throw new BadRequestException('File is too small or corrupted');
    }
  }

  private normalizeActor(actorInput: SecureFileActorInput): SecureFileActor {
    const id = typeof actorInput?.id === 'string' ? actorInput.id.trim() : '';
    if (!id) {
      throw new ForbiddenException('Usuario nao autenticado');
    }

    return {
      id,
      tenantId: typeof actorInput?.tenantId === 'string' ? actorInput.tenantId : null,
      role: typeof actorInput?.role === 'string' ? actorInput.role : null,
    };
  }

  private async getAccessibleFileOrThrow(
    fileId: string,
    actor: SecureFileActor,
    action: 'read' | 'delete',
  ) {
    const file = await this.prisma.secureFile.findFirst({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (file.deletedAt) {
      if (action === 'delete') {
        throw new BadRequestException('File has already been deleted');
      }
      throw new NotFoundException('File has been deleted');
    }

    if (action === 'delete') {
      this.authorizationService.assertCanDeleteSecureFile(actor, file);
    } else {
      this.authorizationService.assertCanReadSecureFile(actor, file);
    }

    await this.assertTenantModuleAccess(file.tenantId, file.moduleName, 'read');
    return file;
  }

  private async logAuditEvent(
    action: string,
    userId: string,
    tenantId: string,
    details: Record<string, unknown>,
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
      this.logger.warn(`Falha ao registrar evento de auditoria de arquivo seguro: ${error.message}`);
    }
  }
}
