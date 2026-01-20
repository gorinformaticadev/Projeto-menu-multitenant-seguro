import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * DTO para criação de backup do banco de dados
 */
export class CreateBackupDto {
  @IsOptional()
  @IsBoolean()
  includeMetadata?: boolean;

  @IsOptional()
  @IsString()
  compressionLevel?: string;

  @IsOptional()
  @IsString()
  sessionId?: string; // Para vincular com SSE progress
}
