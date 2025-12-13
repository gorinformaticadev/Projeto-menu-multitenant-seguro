import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../core/backend/src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../../core/backend/src/common/guards/roles.guard';
import { Roles } from '../../../../../core/backend/src/common/decorators/roles.decorator';
import { ModeloModelService } from '../services/modelo-model.service';

@Controller('modelo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModeloModelController {
  constructor(private readonly modeloService: ModeloModelService) { }

  @Get()
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  getModeloInfo(@Request() req) {
    this.modeloService.logAccess(req.user.id);
    return {
      message: 'Bem-vindo ao módulo Modelo Integrado',
      timestamp: new Date().toISOString()
    };
  }
}