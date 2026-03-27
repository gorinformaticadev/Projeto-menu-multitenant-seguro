import { IsIn, IsOptional, IsString, Matches, MaxLength, IsNumber, IsBoolean, IsArray, ValidateNested, IsObject, IsDate } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export type SystemNotificationSeverityFilter = 'info' | 'warning' | 'critical';

export class ListSystemNotificationsQueryDto {
  @IsOptional()
  @Matches(/^\d+$/)
  page?: string;

  @IsOptional()
  @Matches(/^\d+$/)
  limit?: string;

  @IsOptional()
  @IsIn(['1', '0', 'true', 'false', 'yes', 'no'])
  isRead?: string;

  @IsOptional()
  @IsIn(['1', '0', 'true', 'false', 'yes', 'no'])
  unreadOnly?: string;

  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  severity?: string;
}

export class MarkSystemNotificationReadParamsDto {
  @IsString()
  @MaxLength(80)
  id!: string;
}

export class ReadAllSystemNotificationsDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  targetRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  targetUserId?: string;
}

export class SystemNotificationActionDataDto {
  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiProperty({ required: false })
  @Expose()
  @IsOptional()
  @IsString()
  entityType?: string;
}

export class SystemNotificationDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  type: string;

  @ApiProperty({ enum: ['info', 'warning', 'critical'] })
  @Expose()
  @IsString()
  @IsIn(['info', 'warning', 'critical'])
  severity: string;

  @ApiProperty()
  @Expose()
  @IsString()
  title: string;

  @ApiProperty()
  @Expose()
  @IsString()
  body: string;

  @ApiProperty({ type: SystemNotificationActionDataDto })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => SystemNotificationActionDataDto)
  data: SystemNotificationActionDataDto;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  module: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  source: string | null;

  @ApiProperty()
  @Expose()
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  isRead: boolean;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  readAt: Date | null;
}

export class SystemNotificationListResponseDto {
  @ApiProperty({ type: [SystemNotificationDto] })
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SystemNotificationDto)
  notifications: SystemNotificationDto[];

  @ApiProperty()
  @Expose()
  @IsNumber()
  total: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  unreadCount: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  page: number;

  @ApiProperty()
  @Expose()
  @IsNumber()
  limit: number;

  @ApiProperty()
  @Expose()
  @IsBoolean()
  hasMore: boolean;
}

export class SystemNotificationUnreadCountResponseDto {
  @ApiProperty()
  @Expose()
  @IsNumber()
  count: number;
}

export class SystemNotificationActionResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  success: boolean;

  @ApiProperty({ type: SystemNotificationDto, required: false })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => SystemNotificationDto)
  notification?: SystemNotificationDto;
}

export class SystemNotificationBulkActionResponseDto {
  @ApiProperty()
  @Expose()
  @IsBoolean()
  success: boolean;

  @ApiProperty()
  @Expose()
  @IsNumber()
  count: number;
}
