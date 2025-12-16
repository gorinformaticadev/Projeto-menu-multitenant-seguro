import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogData {
  action: string;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Criar log de auditoria
   */
  async log(data: AuditLogData) {
    return this.prisma.auditLog.create({
      data: {
        action: data.action,
        userId: data.userId,
        tenantId: data.tenantId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        details: data.details ? JSON.stringify(data.details) : null,
      },
    });
  }

  /**
   * Buscar logs com filtros e paginação
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    tenantId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.action) {
      where.action = params.action;
    }

    if (params.userId) {
      where.userId = params.userId;
    }

    if (params.tenantId) {
      where.tenantId = params.tenantId;
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Buscar log por ID
   */
  async findOne(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Estatísticas de logs
   */
  async getStats(params: { startDate?: Date; endDate?: Date; tenantId?: string }) {
    const where: any = {};

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    if (params.tenantId) {
      where.tenantId = params.tenantId;
    }

    const [total, byAction, byUser] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
        orderBy: {
          _count: {
            action: 'desc',
          },
        },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { ...where, userId: { not: null } },
        _count: true,
        orderBy: {
          _count: {
            userId: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    return {
      total,
      byAction: byAction.map((item) => ({
        action: item.action,
        count: item._count,
      })),
      byUser: byUser.map((item) => ({
        userId: item.userId,
        count: item._count,
      })),
    };
  }
}
