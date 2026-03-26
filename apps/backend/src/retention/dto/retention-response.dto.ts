import { IsNumber, IsDateString } from 'class-validator';
import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RetentionSummaryResponseDto {
  @ApiProperty()
  @Expose()
  @IsNumber()
  deletedAuditLogs: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  deletedNotifications: number;

  @ApiProperty()
  @Expose()
  @IsDateString()
  auditCutoff: string;

  @ApiProperty()
  @Expose()
  @IsDateString()
  notificationCutoff: string;
}
