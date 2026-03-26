import { Controller, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { SystemDataRetentionService } from './system-data-retention.service';
import { ValidateResponse } from '@common/decorators/validate-response.decorator';
import { RetentionSummaryResponseDto } from './dto/retention-response.dto';

@Controller('system/retention')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SystemDataRetentionController {
  constructor(private readonly retentionService: SystemDataRetentionService) {}

  @Post('run')
  @ValidateResponse(RetentionSummaryResponseDto)
  async runManually(): Promise<RetentionSummaryResponseDto> {
    const summary = await this.retentionService.runRetentionCleanup('manual');

    return {
      deletedAuditLogs: summary.deletedAuditLogs,
      deletedNotifications: summary.deletedNotifications,
      auditCutoff: summary.auditCutoff.toISOString(),
      notificationCutoff: summary.notificationCutoff.toISOString(),
    };
  }
}
