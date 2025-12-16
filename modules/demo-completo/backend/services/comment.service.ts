import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "@core/prisma/prisma.service";
import { CreateCommentDto } from "../dto/demo.dto";

@Injectable()
export class CommentService {
  constructor(private prisma: PrismaService) { }

  async findAll(demoId: string, tenantId: string) {
    const demo = await this.prisma.demo.findFirst({
      where: { id: demoId, tenantId, deletedAt: null },
    });

    if (!demo) {
      throw new NotFoundException("Demonstração não encontrada");
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
      throw new NotFoundException("Demonstração não encontrada");
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
      throw new NotFoundException("Comentário não encontrado");
    }

    if (comment.demo.tenantId !== tenantId) {
      throw new ForbiddenException(
        "Sem permissão para excluir este comentário",
      );
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException(
        "Você só pode excluir seus próprios comentários",
      );
    }

    await this.prisma.demoComment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: "Comentário removido com sucesso" };
  }
}
