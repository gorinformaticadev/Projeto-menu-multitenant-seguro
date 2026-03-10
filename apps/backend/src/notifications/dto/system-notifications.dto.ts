import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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
