import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { Roles } from '@core/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('audit-logs')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN) // Apenas SUPER_ADMIN pode ver logs
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
      page: this.parsePositiveInt(page),
      limit: this.parsePositiveInt(limit),
      action,
      userId,
      tenantId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * GET /audit-logs/stats
   * Estatisticas de logs
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
   * GET /audit-logs/rate-limit/stats
   * Estatisticas de rate limit por janela de horas
   */
  @Get('rate-limit/stats')
  async getRateLimitStats(
    @Query('hours') hours?: string,
    @Query('tenantId') tenantId?: string,
    @Query('top') top?: string,
  ) {
    return this.auditService.getRateLimitStats({
      hours: this.parsePositiveInt(hours),
      tenantId,
      top: this.parsePositiveInt(top),
    });
  }

  /**
   * GET /audit-logs/rate-limit/blocks
   * Eventos recentes de bloqueio por rate limit
   */
  @Get('rate-limit/blocks')
  async getRateLimitBlockedEvents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
    @Query('hours') hours?: string,
  ) {
    return this.auditService.findRateLimitBlockedEvents({
      page: this.parsePositiveInt(page),
      limit: this.parsePositiveInt(limit),
      tenantId,
      userId,
      hours: this.parsePositiveInt(hours),
    });
  }

  /**
   * GET /audit-logs/:id
   * Buscar log especifico
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }

  private parsePositiveInt(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }

    return parsed;
  }
}
