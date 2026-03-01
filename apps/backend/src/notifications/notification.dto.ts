/**
 * NOTIFICATION DTOs - Data Transfer Objects
 */

import { Type } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsObject, IsUUID, IsBoolean, ValidateNested } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(['info', 'success', 'warning', 'error'])
  type: 'info' | 'success' | 'warning' | 'error';

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class BroadcastNotificationDto {
  @IsOptional()
  title: string;

  @IsOptional()
  description: string;

  @IsOptional()
  type: string;

  @IsOptional()
  message?: string;

  @IsOptional()
  scope: string;

  @IsOptional()
  tenantIds?: unknown[];

  @IsOptional()
  target: string;
}


export class UpdateNotificationDto {
  @IsOptional()
  @IsBoolean()
  read?: boolean;
}

export class NotificationFiltersDto {
  @IsOptional()
  @IsEnum(['info', 'success', 'warning', 'error'])
  type?: 'info' | 'success' | 'warning' | 'error';

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export class PushSubscriptionKeysDto {
  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

export class SavePushSubscriptionDto {
  @IsString()
  endpoint: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

export class RemovePushSubscriptionDto {
  @IsString()
  endpoint: string;
}
