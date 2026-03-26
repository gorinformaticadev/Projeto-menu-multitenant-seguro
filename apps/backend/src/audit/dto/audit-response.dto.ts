import { IsString, IsNumber, IsDate, IsOptional, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AuditUserSummaryDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  name: string;

  @ApiProperty()
  @Expose()
  @IsString()
  email: string;

  @ApiProperty()
  @Expose()
  @IsString()
  role: string;
}

export class AuditLogResponseDto {
  @ApiProperty()
  @Expose()
  @IsString()
  id: string;

  @ApiProperty()
  @Expose()
  @IsString()
  action: string;

  @ApiProperty()
  @Expose()
  @IsString()
  actionLabel: string;

  @ApiProperty()
  @Expose()
  @IsString()
  severity: string;

  @ApiProperty()
  @Expose()
  @IsString()
  message: string;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  actorUserId: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  actorEmail: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  actorRole: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  tenantId: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  ipAddress: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  userAgent: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsObject()
  details: Record<string, unknown> | null;

  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsObject()
  metadata: Record<string, unknown> | null;

  @ApiProperty()
  @Expose()
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ type: AuditUserSummaryDto, nullable: true })
  @Expose()
  @IsOptional()
  @ValidateNested()
  @Type(() => AuditUserSummaryDto)
  user?: AuditUserSummaryDto | null;
}

export class AuditMetaResponseDto {
  @ApiProperty()
  @Expose()
  @IsNumber()
  total: number;

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
  @IsNumber()
  totalPages: number;
}

export class AuditListResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditLogResponseDto)
  data: AuditLogResponseDto[];

  @ApiProperty({ type: AuditMetaResponseDto })
  @Expose()
  @ValidateNested()
  @Type(() => AuditMetaResponseDto)
  meta: AuditMetaResponseDto;
}

export class AuditStatActionDto {
  @ApiProperty()
  @Expose()
  @IsString()
  action: string;

  @ApiProperty()
  @Expose()
  @IsString()
  actionLabel: string;

  @ApiProperty()
  @Expose()
  @IsNumber()
  count: number;
}

export class AuditStatUserDto {
  @ApiProperty({ nullable: true })
  @Expose()
  @IsOptional()
  @IsString()
  userId: string | null;

  @ApiProperty()
  @Expose()
  @IsNumber()
  count: number;
}

export class AuditStatsResponseDto {
  @ApiProperty()
  @Expose()
  @IsNumber()
  total: number;

  @ApiProperty({ type: [AuditStatActionDto] })
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditStatActionDto)
  byAction: AuditStatActionDto[];

  @ApiProperty({ type: [AuditStatUserDto] })
  @Expose()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditStatUserDto)
  byUser: AuditStatUserDto[];
}
