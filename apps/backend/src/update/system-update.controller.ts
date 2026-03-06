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
import { extractRequestContext } from '../common/interceptors/request-context.interceptor';

@Controller('system/update')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class SystemUpdateController {
  constructor(private readonly systemUpdateAdminService: SystemUpdateAdminService) {}

  private rethrowPreservingHttp(error: unknown, fallbackMessage: string): never {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new HttpException(fallbackMessage, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  @Post('run')
  async run(@Body() body: RunSystemUpdateDto, @Request() req: any) {
    try {
      return await this.systemUpdateAdminService.runUpdate({
        version: body.version,
        legacyInplace: body.legacyInplace,
        userId: req.user?.sub || req.user?.id,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        ipAddress: extractRequestContext(req).ip || undefined,
        userAgent: extractRequestContext(req).userAgent || undefined,
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
  async rollback(@Body() body: RunSystemRollbackDto, @Request() req: any) {
    try {
      return await this.systemUpdateAdminService.runRollback({
        target: body.target,
        userId: req.user?.sub || req.user?.id,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        ipAddress: extractRequestContext(req).ip || undefined,
        userAgent: extractRequestContext(req).userAgent || undefined,
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


