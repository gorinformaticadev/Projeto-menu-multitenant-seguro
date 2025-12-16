import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../backend/src/prisma/prisma.service";
import { CreateCommentDto } from "../dto/demo.dto";

@Injectable()
export class CommentService {
  constructor(private prisma: PrismaService) {}

  async findAll(demoId: string, tenantId: string) {
    const demo = await this.prisma.demo.findFirst({
      where: { id: demoId, tenantId, deletedAt: null },
    });

    if (!demo) {
      throw new NotFoundException("DemonstraÃ§Ã£o nÃ£o encontrada");
    }

    return this.prisma.demoComment.findMany({
      where: { demoId, deletedAt: null },
      include: {
        replies: {
          where: { deletedAt: null },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    demoId: string,
    data: CreateCommentDto,
    tenantId: string,
    userId: string,
  ) {
    const demo = await this.prisma.demo.findFirst({
      where: { id: demoId, tenantId, deletedAt: null },
    });

    if (!demo) {
      throw new NotFoundException("DemonstraÃ§Ã£o nÃ£o encontrada");
    }

    return this.prisma.demoComment.create({
      data: {
        ...data,
        demoId,
        userId,
      },
    });
  }

  async remove(id: string, tenantId: string, userId: string) {
    const comment = await this.prisma.demoComment.findFirst({
      where: { id },
      include: {
        demo: true,
      },
    });

    if (!comment) {
      throw new NotFoundException("ComentÃ¡rio nÃ£o encontrado");
    }

    if (comment.demo.tenantId !== tenantId) {
      throw new ForbiddenException(
        "Sem permissÃ£o para excluir este comentÃ¡rio",
      );
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException(
        "VocÃª sÃ³ pode excluir seus prÃ³prios comentÃ¡rios",
      );
    }

    await this.prisma.demoComment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: "ComentÃ¡rio removido com sucesso" };
  }
}

