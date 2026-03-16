import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import {
  RunSystemRollbackDto,
  RunSystemUpdateDto,
  SystemUpdateLogQueryDto,
} from './dto/system-update-admin.dto';
import { SystemUpdateAdminService } from './system-update-admin.service';
import { extractAuditContext } from '../audit/audit-request-context.util';
import { CriticalRateLimit } from '@common/decorators/critical-rate-limit.decorator';

@Controller('system/update')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SystemUpdateController {
  constructor(private readonly systemUpdateAdminService: SystemUpdateAdminService) {}

  private rethrowPreservingHttp(error: unknown, fallbackMessage: string): never {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(fallbackMessage, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  @Post('run')
  @CriticalRateLimit('update')
  async run(@Body() body: RunSystemUpdateDto, @Request() req: any) {
    const { actor, requestCtx } = extractAuditContext(req);
    const userId = actor.userId || 'unknown';

    try {
      return await this.systemUpdateAdminService.runUpdate({
        version: body.version,
        legacyInplace: body.legacyInplace,
        userId,
        userEmail: actor.email,
        userRole: actor.role,
        ipAddress: requestCtx.ip || undefined,
        userAgent: requestCtx.userAgent || undefined,
      });
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao iniciar update');
    }
  }

  @Get('status')
  async status() {
    try {
      return await this.systemUpdateAdminService.getStatus();
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao ler status de update');
    }
  }

  @Get('log')
  async log(@Query() query: SystemUpdateLogQueryDto) {
    try {
      const rawTail = query.tail as unknown as number | string | undefined;
      const parsed = Number(rawTail ?? 200);
      return await this.systemUpdateAdminService.getLogTail(parsed);
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao ler log de update');
    }
  }

  @Post('rollback')
  @CriticalRateLimit('update')
  async rollback(@Body() body: RunSystemRollbackDto, @Request() req: any) {
    const { actor, requestCtx } = extractAuditContext(req);
    const userId = actor.userId || 'unknown';

    try {
      return await this.systemUpdateAdminService.runRollback({
        target: body.target,
        userId,
        userEmail: actor.email,
        userRole: actor.role,
        ipAddress: requestCtx.ip || undefined,
        userAgent: requestCtx.userAgent || undefined,
      });
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao iniciar rollback');
    }
  }

  @Get('releases')
  async releases() {
    try {
      return await this.systemUpdateAdminService.listReleases();
    } catch (error) {
      this.rethrowPreservingHttp(error, 'Erro ao listar releases');
    }
  }
}
