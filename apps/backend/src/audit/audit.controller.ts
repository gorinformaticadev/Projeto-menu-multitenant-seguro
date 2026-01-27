import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('audit-logs')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN' as any) // Apenas SUPER_ADMIN pode ver logs
export class AuditController {
  constructor(private readonly auditService: AuditService) {
    // Empty implementation
  }

  /**
   * GET /audit-logs
   * Listar logs de auditoria com filtros
   */
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.findAll({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      action,
      userId,
      tenantId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * GET /audit-logs/stats
   * EstatÃ­sticas de logs
   */
  @Get('stats')
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.auditService.getStats({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      tenantId,
    });
  }

  /**
   * GET /audit-logs/:id
   * Buscar log especÃ­fico
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}

