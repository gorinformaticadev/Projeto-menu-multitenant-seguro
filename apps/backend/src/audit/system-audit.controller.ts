import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { AuditService } from './audit.service';

const SYSTEM_AUDIT_PREFIXES = ['UPDATE_', 'MAINTENANCE_'];

@Controller('system/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class SystemAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('severity') severity?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.findAll({
      page: this.parsePositiveInt(page),
      limit: this.parsePositiveInt(limit),
      action,
      allowedActionPrefixes: SYSTEM_AUDIT_PREFIXES,
      severity,
      actorUserId,
      from: this.parseDate(from),
      to: this.parseDate(to),
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const log = await this.auditService.findOne(id);
    if (!log || typeof log.action !== 'string') {
      return null;
    }

    return this.isSystemAuditAction(log.action) ? log : null;
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

  private parseDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return parsed;
  }

  private isSystemAuditAction(action: string): boolean {
    const normalized = action.trim().toUpperCase();
    return SYSTEM_AUDIT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  }
}
