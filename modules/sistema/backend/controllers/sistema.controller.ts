import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { SistemaService } from '../services/sistema.service';
import { JwtAuthGuard } from '@core/guards/jwt-auth.guard';
import { RolesGuard } from '@core/guards/roles.guard';
import { Roles } from '@core/decorators/roles.decorator';

@Controller('api/sistema')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SistemaController {
  constructor(private readonly sistemaService: SistemaService) { }

  @Get()
  async findAll(@Query() filters: any, @Req() req) {
    const tenantId = req.user?.tenantId;
    return this.sistemaService.findAll(tenantId, filters);
  }

  @Get('stats')
  async getStats(@Req() req) {
    const tenantId = req.user?.tenantId;
    return this.sistemaService.getStats(tenantId);
  }
}