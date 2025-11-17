import { IsEmail, IsString, IsOptional, Matches, MinLength, IsBoolean } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(11, { message: 'CNPJ/CPF deve ter no mínimo 11 caracteres' })
  cnpjCpf?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Nome fantasia deve ter no mínimo 3 caracteres' })
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Nome do responsável deve ter no mínimo 3 caracteres' })
  nomeResponsavel?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d\s\(\)\-\+]+$/, { message: 'Telefone inválido' })
  telefone?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
