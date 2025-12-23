import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO para query/filtro de arquivos
 */
export class FileQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  moduleName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentType?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}
