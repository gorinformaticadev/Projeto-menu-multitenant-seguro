import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "@core/prisma/prisma.service";
import { CreateDemoDto, UpdateDemoDto, FilterDemoDto } from "../dto/demo.dto";

/**
 * Serviço de Demonstrações
 * Implementa toda a lógica de negócio do módulo
 */
@Injectable()
export class DemoService {
  constructor(private prisma: PrismaService) { }

  /**
   * Lista todas as demonstrações com filtros
   */
  async findAll(tenantId: string, filters: FilterDemoDto) {
    const { page = 1, limit = 10, status, search, categoryId, tagId } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    if (categoryId) {
      where.categories = {
        some: { categoryId },
      };
    }
    if (tagId) {
      where.tags = {
        some: { tagId },
      };
    }

    const [demos, total] = await Promise.all([
      this.prisma.demo.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.demo.count({ where }),
    ]);

    return {
      data: demos,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Busca uma demonstração por ID
   */
  async findOne(id: string, tenantId: string) {
    const demo = await this.prisma.demo.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        attachments: true,
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!demo) {
      throw new NotFoundException("Demonstração não encontrada");
    }

    // Incrementar contador de visualizações
    await this.prisma.demo.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    });

    return demo;
  }

  /**
   * Cria uma nova demonstração
   */
  async create(data: CreateDemoDto, tenantId: string, userId: string) {
    const demo = await this.prisma.demo.create({
      data: {
        ...data,
        tenantId,
        createdBy: userId,
      },
      include: {
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    // Registrar atividade
    await this.logActivity(demo.id, userId, "created", { status: demo.status });

    return demo;
  }

  /**
   * Atualiza uma demonstração
   */
  async update(
    id: string,
    data: UpdateDemoDto,
    tenantId: string,
    userId: string,
  ) {
    const existing = await this.prisma.demo.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException("Demonstração não encontrada");
    }

    const demo = await this.prisma.demo.update({
      where: { id },
      data: {
        ...data,
        updatedBy: userId,
      },
      include: {
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    // Registrar atividade
    await this.logActivity(id, userId, "updated", data);

    return demo;
  }

  /**
   * Remove uma demonstração (soft delete)
   */
  async remove(id: string, tenantId: string) {
    const demo = await this.prisma.demo.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!demo) {
      throw new NotFoundException("Demonstração não encontrada");
    }

    await this.prisma.demo.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: "Demonstração removida com sucesso" };
  }

  /**
   * Publica uma demonstração
   */
  async publish(id: string, tenantId: string, userId: string) {
    const demo = await this.prisma.demo.update({
      where: { id, tenantId },
      data: { status: "published" },
    });

    await this.logActivity(id, userId, "published", { status: "published" });

    return demo;
  }

  /**
   * Adiciona um like na demonstração
   */
  async like(id: string, tenantId: string, userId: string) {
    await this.prisma.demo.update({
      where: { id, tenantId },
      data: { likesCount: { increment: 1 } },
    });

    await this.logActivity(id, userId, "liked", {});

    return { message: "Like adicionado com sucesso" };
  }

  /**
   * Lista categorias
   */
  async getCategories(tenantId: string) {
    return this.prisma.demoCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { orderIndex: "asc" },
    });
  }

  /**
   * Lista tags
   */
  async getTags(tenantId: string) {
    return this.prisma.demoTag.findMany({
      where: { tenantId },
      orderBy: { usageCount: "desc" },
    });
  }

  /**
   * Retorna estatísticas
   */
  async getStats(tenantId: string) {
    const [total, published, draft, categories, tags, views, likes] =
      await Promise.all([
        this.prisma.demo.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.demo.count({
          where: { tenantId, status: "published", deletedAt: null },
        }),
        this.prisma.demo.count({
          where: { tenantId, status: "draft", deletedAt: null },
        }),
        this.prisma.demoCategory.count({ where: { tenantId, isActive: true } }),
        this.prisma.demoTag.count({ where: { tenantId } }),
        this.prisma.demo.aggregate({
          where: { tenantId },
          _sum: { viewsCount: true },
        }),
        this.prisma.demo.aggregate({
          where: { tenantId },
          _sum: { likesCount: true },
        }),
      ]);

    return {
      total,
      published,
      draft,
      categories,
      tags,
      totalViews: views._sum.viewsCount || 0,
      totalLikes: likes._sum.likesCount || 0,
    };
  }

  /**
   * Registra atividade no log de auditoria
   */
  private async logActivity(
    demoId: string,
    userId: string,
    action: string,
    changes: any,
  ) {
    await this.prisma.demoActivity.create({
      data: {
        demoId,
        userId,
        action,
        changes,
      },
    });
  }
}
