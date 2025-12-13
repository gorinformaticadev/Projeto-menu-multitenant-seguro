import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../core/backend/src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../../../../core/backend/src/auth/permissions.guard';
import { Permissions } from '../../../../../core/backend/src/auth/permissions.decorator';
import { ModeloModelService } from '../services/modelo-model.service';

@Controller('modelo')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ModeloModelController {
  constructor(private readonly modeloService: ModeloModelService) { }

  @Get()
  @Permissions('modelo.view')
  getModeloInfo(@Request() req) {
    this.modeloService.logAccess(req.user.id);
    return {
      message: 'Bem-vindo ao módulo Modelo Integrado',
      timestamp: new Date().toISOString()
    };
  }
}