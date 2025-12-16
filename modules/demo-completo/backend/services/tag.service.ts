import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@core/prisma/prisma.service";
import { CreateTagDto } from "../dto/demo.dto";

@Injectable()
export class TagService {
  constructor(private prisma: PrismaService) { }

  async findAll(tenantId: string) {
    return this.prisma.demoTag.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { demos: true },
        },
      },
    });
  }

  async getPopular(tenantId: string, limit = 10) {
    return this.prisma.demoTag.findMany({
      where: { tenantId },
      orderBy: { usageCount: "desc" },
      take: limit,
    });
  }

  async create(data: CreateTagDto, tenantId: string) {
    return this.prisma.demoTag.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const tag = await this.prisma.demoTag.findFirst({
      where: { id, tenantId },
    });

    if (!tag) {
      throw new NotFoundException("Tag não encontrada");
    }

    await this.prisma.demoTag.delete({
      where: { id },
    });

    return { message: "Tag removida com sucesso" };
  }
}
