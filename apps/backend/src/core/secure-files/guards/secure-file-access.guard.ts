import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';

/**
 * Guard para validar acesso a arquivo sensível
 * Valida:
 * 1. Arquivo pertence ao tenant do usuário
 * 2. Arquivo não está deletado
 */
@Injectable()
export class SecureFileAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {
      // Empty implementation
    }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const fileId = request.params.fileId;

    if (!user || !user.tenantId) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    if (!fileId) {
      throw new ForbiddenException('ID de arquivo não fornecido');
    }

    // Buscar arquivo
    const file = await this.prisma.secureFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        tenantId: true,
        moduleName: true,
        deletedAt: true,
      },
    });

    if (!file) {
      throw new NotFoundException('Arquivo não encontrado');
    }

    // Validar que arquivo pertence ao tenant do usuário
    if (file.tenantId !== user.tenantId) {
      throw new ForbiddenException('Acesso negado');
    }

    // Validar que arquivo não está deletado
    if (file.deletedAt) {
      throw new NotFoundException('Arquivo foi deletado');
    }

    const moduleRecord = await this.prisma.module.findUnique({
      where: { slug: file.moduleName },
      select: { id: true },
    });

    if (!moduleRecord) {
      throw new ForbiddenException('Modulo associado ao arquivo nao existe');
    }

    const tenantModule = await this.prisma.moduleTenant.findUnique({
      where: {
        moduleId_tenantId: {
          moduleId: moduleRecord.id,
          tenantId: user.tenantId,
        },
      },
      select: { enabled: true },
    });

    if (!tenantModule?.enabled) {
      throw new ForbiddenException('Modulo nao habilitado para este tenant');
    }

    return true;
  }
}
