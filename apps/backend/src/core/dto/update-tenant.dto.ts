import { IsEmail, IsString, IsOptional, Matches, MinLength, IsBoolean } from 'class-validator';
import { IsValidCPFOrCNPJ } from '@core/common/validators/cpf-cnpj.validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email invÃ¡lido' })
  email?: string;

  @IsOptional()
  @IsString()
  @IsValidCPFOrCNPJ({ message: 'CNPJ/CPF invÃ¡lido' })
  cnpjCpf?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Nome fantasia deve ter no mÃ­nimo 3 caracteres' })
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Nome do responsÃ¡vel deve ter no mÃ­nimo 3 caracteres' })
  nomeResponsavel?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d\s\(\)\-\+]+$/, { message: 'Telefone invÃ¡lido' })
  telefone?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

