import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { AuthorizationService } from '@common/services/authorization.service';

/**
 * Guard para validar acesso a arquivo sensivel
 */
@Injectable()
export class SecureFileAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const fileId = request.params.fileId;

    if (!user?.id) {
      throw new ForbiddenException('Usuario nao autenticado');
    }

    if (!fileId) {
      throw new ForbiddenException('ID de arquivo nao fornecido');
    }

    const file = await this.prisma.secureFile.findFirst({
      where: { id: fileId },
      select: {
        id: true,
        tenantId: true,
        moduleName: true,
        deletedAt: true,
        uploadedBy: true,
      },
    });

    if (!file) {
      throw new NotFoundException('Arquivo nao encontrado');
    }

    if (file.deletedAt) {
      throw new NotFoundException('Arquivo foi deletado');
    }

    if (request.method?.toUpperCase() === 'DELETE') {
      this.authorizationService.assertCanDeleteSecureFile(user, file);
    } else {
      this.authorizationService.assertCanReadSecureFile(user, file);
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
          tenantId: file.tenantId,
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
