import { IsBoolean, IsNumber, IsOptional, IsString, IsDefined } from 'class-validator';
import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para o estado do modo de manutenção
 * Define o contrato de resposta para o endpoint /api/system/maintenance/state
 */
export class MaintenanceStateDto {
  @ApiProperty({ description: 'Indica se o modo de manutenção está ativo' })
  @Expose()
  @IsDefined()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Motivo da manutenção', nullable: true, required: false })
  @Expose()
  @IsOptional()
  @IsString()
  reason: string | null;

  @ApiProperty({ description: 'Data/hora de início da manutenção', nullable: true, required: false })
  @Expose()
  @IsOptional()
  @IsString()
  startedAt: string | null;

  @ApiProperty({ description: 'Tempo estimado restante em segundos', nullable: true, required: false })
  @Expose()
  @IsOptional()
  @IsNumber()
  etaSeconds: number | null;
}
