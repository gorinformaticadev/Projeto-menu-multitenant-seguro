import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { CriticalRateLimit } from '@common/decorators/critical-rate-limit.decorator';
import { extractAuditContext } from '../../audit/audit-request-context.util';
import { CreateUpdateExecutionDto } from './dto/create-update-execution.dto';
import { UpdateExecutionFacadeService } from './update-execution.facade.service';

type AuthenticatedRequest = ExpressRequest & {
  user?: {
    id?: string;
    sub?: string;
    email?: string;
    role?: string;
    tenantId?: string | null;
  };
};

@Controller('system/update/executions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class UpdateExecutionController {
  constructor(private readonly updateExecutionFacadeService: UpdateExecutionFacadeService) {}

  private rethrowPreservingHttp(error: unknown, fallbackMessage: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    throw new HttpException(fallbackMessage, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  @Post()
  @CriticalRateLimit('update')
  async create(@Body() body: CreateUpdateExecutionDto, @Request() req: AuthenticatedRequest) {
    const { actor, requestCtx } = extractAuditContext(req);
    const requestedBy = actor.userId || 'unknown';

    try {
      return await this.updateExecutionFacadeService.requestExecution({
        targetVersion: body.version,
        requestedBy,
        source: 'panel',
        mode: body.mode,
        rollbackPolicy: body.rollbackPolicy,
        metadata: {
          userEmail: actor.email || null,
          userRole: actor.role || null,
          ipAddress: requestCtx.ip || null,
          userAgent: requestCtx.userAgent || null,
        },
      });
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao criar execucao canonica de update');
    }
  }

  @Get('current')
  async current() {
    try {
      return await this.updateExecutionFacadeService.getCurrentExecutionView();
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao obter execucao canonica atual');
    }
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    try {
      return await this.updateExecutionFacadeService.getExecutionView(id);
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao obter execucao canonica');
    }
  }

  @Get(':id/steps')
  async steps(@Param('id') id: string) {
    try {
      return await this.updateExecutionFacadeService.listExecutionSteps(id);
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao obter etapas da execucao canonica');
    }
  }
}
