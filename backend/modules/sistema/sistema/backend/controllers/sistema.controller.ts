import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { SistemaService } from '../services/sistema.service';
import { JwtAuthGuard } from '../../../../../backend/src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../../backend/src/common/guards/roles.guard';
import { Roles } from '../../../../../backend/src/common/decorators/roles.decorator';

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