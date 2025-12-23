import { IsString, IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';

/**
 * DTO para upload de arquivo sensível
 */
export class UploadFileDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome do módulo é obrigatório' })
  @MaxLength(100, { message: 'Nome do módulo muito longo' })
  moduleName: string;

  @IsString()
  @IsNotEmpty({ message: 'Tipo de documento é obrigatório' })
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Tipo de documento deve conter apenas letras minúsculas, números e hífens',
  })
  @MaxLength(100, { message: 'Tipo de documento muito longo' })
  documentType: string;

  @IsOptional()
  @IsString()
  metadata?: string; // JSON string
}
