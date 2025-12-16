import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@core/prisma/prisma.service";
import { CreateCategoryDto, UpdateCategoryDto } from "../dto/demo.dto";

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) { }

  async findAll(tenantId: string) {
    return this.prisma.demoCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { orderIndex: "asc" },
      include: {
        _count: {
          select: { demos: true },
        },
      },
    });
  }

  async findOne(id: string, tenantId: string) {
    const category = await this.prisma.demoCategory.findFirst({
      where: { id, tenantId },
      include: {
        demos: {
          include: {
            demo: {
              select: {
                id: true,
                title: true,
                description: true,
                status: true,
                viewsCount: true,
                likesCount: true,
              },
            },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException("Categoria não encontrada");
    }

    return category;
  }

  async create(data: CreateCategoryDto, tenantId: string) {
    return this.prisma.demoCategory.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async update(id: string, data: UpdateCategoryDto, tenantId: string) {
    const category = await this.prisma.demoCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException("Categoria não encontrada");
    }

    return this.prisma.demoCategory.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, tenantId: string) {
    const category = await this.prisma.demoCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException("Categoria não encontrada");
    }

    await this.prisma.demoCategory.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: "Categoria removida com sucesso" };
  }
}
